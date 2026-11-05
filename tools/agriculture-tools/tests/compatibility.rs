use agriculture_tools::{demo, sample};
use shapefile::dbase::{FieldValue, Record, TableWriterBuilder};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let name = format!(
            "agriculture-rust-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(name);
        fs::create_dir(&path).unwrap();
        Self(path)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let resolved = fs::canonicalize(&self.0).unwrap();
        let parent = fs::canonicalize(std::env::temp_dir()).unwrap();
        assert!(resolved.starts_with(parent));
        assert!(resolved
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("agriculture-rust-"));
        fs::remove_dir_all(resolved).unwrap();
    }
}
fn write_month(root: &Path, month: &str, values: &[(i32, i32, f64)]) {
    let fields = TableWriterBuilder::new()
        .add_numeric_field("ROW".try_into().unwrap(), 8, 0)
        .add_numeric_field("COLUMN".try_into().unwrap(), 8, 0)
        .add_numeric_field("HEAD".try_into().unwrap(), 50, 10);
    let mut writer =
        shapefile::Writer::from_path(root.join(format!("Head_{month}.shp")), fields).unwrap();
    for &(row, col, head) in values {
        let mut record = Record::default();
        for (field, value) in [
            ("ROW", f64::from(row)),
            ("COLUMN", f64::from(col)),
            ("HEAD", head),
        ] {
            record.insert(field.into(), FieldValue::Numeric(Some(value)));
        }
        let point = shapefile::Point::new(
            1_000_000.0 + f64::from(col) * 50.0,
            2_000_000.0 - f64::from(row) * 50.0,
        );
        writer.write_shape_and_record(&point, &record).unwrap();
    }
}

#[test]
fn shapefile_rounding_month_fallbacks_and_synthetic_labels_are_preserved() {
    let dir = Fixture::new();
    write_month(
        &dir.0,
        "05",
        &[(2, 2, 50.125), (4, 4, 2.675), (3, 2, 99.0), (6, 6, 1e30)],
    );
    write_month(&dir.0, "06", &[(2, 2, 1e30)]);
    write_month(&dir.0, "08", &[(2, 2, 110.0)]);
    let data = sample::generate(&dir.0).unwrap();
    assert_eq!(data["grids"].as_array().unwrap().len(), 2);
    let first = &data["grids"][0];
    let second = &data["grids"][1];
    assert_eq!(first["id"], "YG-R2_C2");
    assert_eq!(first["heads"]["05"], 50.12);
    assert_eq!(first["heads"]["06"], 50.12);
    assert_eq!(first["heads"]["07"], 80.12);
    assert_eq!(second["heads"]["05"], 2.67);
    assert_eq!(second["heads"]["06"], 12.67);
    assert_eq!(first["polygon"].as_array().unwrap().len(), 4);
    assert_eq!(data["metadata"]["year"], serde_json::Value::Null);
    assert_eq!(
        data["metadata"]["dataStatus"],
        "prototype_with_synthetic_examples"
    );
    assert_eq!(
        data["anomalies"][0]["description"],
        "급격한 수위 상승 (+30.0m/월) - 저지대 침수 및 관망 배수역류 위험"
    );
}

#[test]
fn sample_cli_protects_current_data_and_writes_a_separate_json() {
    let dir = Fixture::new();
    let active = dir.0.join("src/data/groundwater_data.json");
    fs::create_dir_all(active.parent().unwrap()).unwrap();
    fs::write(&active, b"current 2025 data").unwrap();
    let failure = Command::new(env!("CARGO_BIN_EXE_process-sample-data"))
        .args([
            "--root",
            dir.0.to_str().unwrap(),
            "--output",
            active.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(!failure.status.success());
    assert!(String::from_utf8_lossy(&failure.stderr).contains("Refusing to overwrite"));
    assert_eq!(fs::read(&active).unwrap(), b"current 2025 data");
    let sample = dir.0.join("01_Sample");
    fs::create_dir(&sample).unwrap();
    write_month(&sample, "05", &[(2, 2, 50.0)]);
    let result = Command::new(env!("CARGO_BIN_EXE_process-sample-data"))
        .args(["--root", dir.0.to_str().unwrap()])
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let output: serde_json::Value = serde_json::from_slice(
        &fs::read(dir.0.join("output/sample-data/groundwater_sample.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(output["grids"][0]["heads"]["05"], 50.0);
    assert_eq!(fs::read(&active).unwrap(), b"current 2025 data");
}

#[test]
fn edited_markdown_is_preserved_until_reset_is_explicit() {
    let dir = Fixture::new();
    let file = dir.0.join("수정문서.md");
    fs::write(&file, "# 직접 수정한 문서\n본문").unwrap();
    let existing = demo::ensure_default_source(&file, "# 초기 문서", false).unwrap();
    assert!(existing.contains("직접 수정한"));
    assert_eq!(
        demo::ensure_default_source(&file, "# 초기 문서", true).unwrap(),
        "# 초기 문서"
    );
}
