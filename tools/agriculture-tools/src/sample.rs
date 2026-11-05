//! The retired 5-9 month example generator. Never use this for the 2025 source data.
use anyhow::{bail, ensure, Context, Result};
use proj4rs::{proj::Proj, transform::transform};
use serde_json::{json, Map, Value};
use shapefile::dbase::{FieldValue, Record};
use std::{collections::HashMap, path::Path};

const DX: f64 = 49.975_665_667_327_52;
const STEP: i64 = 2;

// Formatting rounds the exact binary float to decimal ties-to-even, as Python round(x,n)
// does. Multiplication by 10^n followed by round() would change cases such as 2.675.
pub fn decimal_round(value: f64, places: usize) -> f64 {
    format!("{value:.places$}").parse().expect("finite decimal")
}

fn number(record: &Record, field: &str) -> Result<f64> {
    let value = match record.get(field) {
        Some(FieldValue::Numeric(Some(n)) | FieldValue::Double(n) | FieldValue::Currency(n)) => *n,
        Some(FieldValue::Integer(n)) => f64::from(*n),
        Some(FieldValue::Float(Some(n))) => f64::from(*n),
        _ => bail!("Missing or nonnumeric DBF field {field}"),
    };
    ensure!(value.is_finite(), "Non-finite DBF field {field}");
    Ok(value)
}

fn key(record: &Record) -> Result<(i64, i64)> {
    let row = number(record, "ROW")?;
    let col = number(record, "COLUMN")?;
    ensure!(
        row.fract() == 0.0 && col.fract() == 0.0 && row.abs() < 1e9 && col.abs() < 1e9,
        "Invalid row/column"
    );
    Ok((row as i64, col as i64))
}

pub struct CoordinateTransform {
    from: Proj,
    to: Proj,
}
impl CoordinateTransform {
    pub fn new() -> Result<Self> {
        Ok(Self {
            from: Proj::from_proj_string("+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0 +units=m +no_defs")?,
            to: Proj::from_proj_string("+proj=longlat +datum=WGS84 +no_defs")?,
        })
    }
    pub fn lon_lat(&self, x: f64, y: f64) -> Result<(f64, f64)> {
        let mut point = (x, y, 0.0);
        transform(&self.from, &self.to, &mut point)?;
        let lon = point.0.to_degrees();
        let lat = point.1.to_degrees();
        ensure!(
            lon.is_finite() && lat.is_finite(),
            "Coordinate transformation failed"
        );
        Ok((lon, lat))
    }
}

fn py_float(n: f64) -> String {
    if n.fract() == 0.0 {
        format!("{n:.1}")
    } else {
        n.to_string()
    }
}

pub fn generate(sample_dir: &Path) -> Result<Value> {
    let projection = CoordinateTransform::new()?;
    let mut grids: Vec<Value> = Vec::new();
    let mut positions = HashMap::new();
    let base = sample_dir.join("Head_05.shp");
    let mut reader =
        shapefile::Reader::from_path(&base).with_context(|| format!("Read {}", base.display()))?;
    for entry in reader.iter_shapes_and_records() {
        let (shape, record) = entry?;
        let (row, col) = key(&record)?;
        let head = number(&record, "HEAD")?;
        if head >= 1e29 || row % STEP != 0 || col % STEP != 0 {
            continue;
        }
        let (x, y) = match shape {
            shapefile::Shape::Point(p) => (p.x, p.y),
            shapefile::Shape::PointM(p) => (p.x, p.y),
            shapefile::Shape::PointZ(p) => (p.x, p.y),
            _ => bail!("Legacy inputs must contain Point/PointM/PointZ shapes"),
        };
        let (lon, lat) = projection.lon_lat(x, y)?;
        let half = DX * STEP as f64 / 2.0;
        let mut polygon = Vec::new();
        for (cx, cy) in [
            (x - half, y + half),
            (x + half, y + half),
            (x + half, y - half),
            (x - half, y - half),
        ] {
            let (clon, clat) = projection.lon_lat(cx, cy)?;
            polygon.push(json!([decimal_round(clat, 6), decimal_round(clon, 6)]));
        }
        let grid = json!({"id":format!("YG-R{row}_C{col}"),"row":row,"col":col,
            "x":decimal_round(x,1),"y":decimal_round(y,1),"lat":decimal_round(lat,6),"lon":decimal_round(lon,6),
            "polygon":polygon,"heads":{"05":decimal_round(head,2)}});
        if let Some(&index) = positions.get(&(row, col)) {
            grids[index] = grid;
        } else {
            positions.insert((row, col), grids.len());
            grids.push(grid);
        }
    }
    ensure!(
        !grids.is_empty(),
        "No valid even-row/even-column sample cells in Head_05"
    );
    for month in ["06", "07", "08", "09"] {
        let file = sample_dir.join(format!("Head_{month}.shp"));
        if !file.exists() {
            continue;
        }
        let mut dbf = shapefile::dbase::Reader::from_path(file.with_extension("dbf"))?;
        for entry in dbf.iter_records() {
            let record = entry?;
            let position = key(&record)?;
            if let Some(&index) = positions.get(&position) {
                let head = number(&record, "HEAD")?;
                let value = if head < 1e29 {
                    decimal_round(head, 2)
                } else {
                    grids[index]["heads"]["05"].as_f64().unwrap()
                };
                grids[index]["heads"][month] = json!(value);
            }
        }
    }
    let min_lat = grids
        .iter()
        .map(|g| g["lat"].as_f64().unwrap())
        .fold(f64::INFINITY, f64::min);
    let max_lat = grids
        .iter()
        .map(|g| g["lat"].as_f64().unwrap())
        .fold(f64::NEG_INFINITY, f64::max);
    let min_lon = grids
        .iter()
        .map(|g| g["lon"].as_f64().unwrap())
        .fold(f64::INFINITY, f64::min);
    let max_lon = grids
        .iter()
        .map(|g| g["lon"].as_f64().unwrap())
        .fold(f64::NEG_INFINITY, f64::max);
    let mut final_grids = Vec::new();
    let mut anomalies = Vec::new();
    for g in grids {
        let get = |month: &str, default| g["heads"][month].as_f64().unwrap_or(default);
        let h05 = get("05", 50.0);
        let h06 = get("06", h05 + 10.0);
        let h07 = get("07", h05 + 30.0);
        let h08 = get("08", h05 + 28.0);
        let h09 = get("09", h05 + 14.0);
        let values = [
            h05 - 4.5,
            h05 - 5.2,
            h05 - 3.1,
            h05 - 1.5,
            h05,
            h06,
            h07,
            h08,
            h09,
            h09 - 11.0,
            h09 - 16.5,
            h09 - 20.0,
        ];
        let heads: Map<String, Value> = values
            .iter()
            .enumerate()
            .map(|(i, v)| (format!("{:02}", i + 1), json!(decimal_round(*v, 2))))
            .collect();
        let surface = h05 + 1.2 + ((h05 - 30.0) / 220.0).max(0.0).powf(1.3) * 48.0;
        let depth = (surface - h08).max(0.5);
        let vulnerability = decimal_round(
            if depth <= 1.5 {
                (0.82 + (1.5 - depth) * 0.12).min(0.96)
            } else if depth <= 4.0 {
                0.55 + (4.0 - depth) * 0.10
            } else if depth <= 8.0 {
                0.32 + (8.0 - depth) * 0.05
            } else {
                (0.28 - (depth - 8.0) * 0.015).max(0.05)
            },
            2,
        );
        let delta = decimal_round(h08 - h05, 2);
        let rate = decimal_round(h07 - h06, 2);
        let soil = if vulnerability > 0.6 {
            "충적층 (모래/자갈)"
        } else if vulnerability > 0.35 {
            "풍화토층"
        } else {
            "기반암 대수층"
        };
        let item = json!({"id":g["id"],"row":g["row"],"col":g["col"],"x":g["x"],"y":g["y"],
            "lat":g["lat"],"lon":g["lon"],"polygon":g["polygon"],"surfaceEl":decimal_round(surface,1),
            "heads":heads,"vulnScore":vulnerability,"deltaSeason":delta,"soilType":soil});
        if (rate > 40.0 || delta > 55.0) && anomalies.len() < 10 {
            anomalies.push(json!({"id":item["id"],"lat":item["lat"],"lon":item["lon"],"row":item["row"],"col":item["col"],
                "currentHead":item["heads"]["08"],"delta":rate,"type":if rate>0.0 {"SURGE"}else{"DROP"},
                "severity":if rate>50.0 {"CRITICAL"}else{"WARNING"},
                "description":if rate>0.0 {format!("급격한 수위 상승 (+{}m/월) - 저지대 침수 및 관망 배수역류 위험",py_float(rate))}
                else {format!("수위 급강하 ({}m/월) - 갈수기 취수 장애 경보",py_float(rate))}}));
        }
        final_grids.push(item);
    }
    let mut contours = Vec::new();
    let center_lat = (min_lat + max_lat) / 2.0;
    let center_lon = (min_lon + max_lon) / 2.0;
    for level in [40, 60, 80, 100, 120, 150, 200] {
        let rx = 0.025 + (f64::from(level) / 300.0) * 0.065;
        let ry = 0.02 + (f64::from(level) / 300.0) * 0.075;
        for (start, end, upper) in [(10, 175, true), (190, 350, false)] {
            let mut points = Vec::new();
            for degree in (start..end).step_by(15) {
                let rad = f64::from(degree).to_radians();
                let noise = if upper {
                    (rad * 3.0).sin() * 0.007
                } else {
                    (rad * 4.0).cos() * 0.005
                };
                let scale = if upper { 1.0 } else { 0.85 };
                let lon = center_lon + (rx * scale + noise) * rad.cos();
                let lat = if upper {
                    center_lat - 0.015
                } else {
                    center_lat + 0.025
                } + (ry * scale + noise) * rad.sin();
                if (min_lon..=max_lon).contains(&lon) && (min_lat..=max_lat).contains(&lat) {
                    points.push(json!([decimal_round(lon, 5), decimal_round(lat, 5)]));
                }
            }
            if points.len() > 2 {
                contours.push(json!({"elevation":level,"coordinates":points}));
            }
        }
    }
    let layers: Value = serde_json::from_str(include_str!("../assets/legacy-layers.json"))?;
    Ok(
        json!({"metadata":{"watershedName":"충남 공주시 유구천 표준유역","watershedCode":"301206",
        "modelEngine":"USGS MODFLOW-6 Steady-State","gridSize":"50m × 50m","sourceCellSizeM":DX,"displayCellSizeM":DX*STEP as f64,
        "samplingStep":STEP,"year":null,"dataStatus":"prototype_with_synthetic_examples",
        "syntheticMonths":["01","02","03","04","10","11","12"],
        "syntheticLayers":["surfaceEl","soilType","contourLines","drainagePolygons","observationWells"],
        "totalCells":235935,"activeCells":113076,"sampledNodes":final_grids.len(),"calibratedMonths":["05","06","07","08","09"],
        "crs":"EPSG:5179 (Korea 2000 / UTM-K)","bounds":{"minLat":decimal_round(min_lat,4),"maxLat":decimal_round(max_lat,4),
        "minLon":decimal_round(min_lon,4),"maxLon":decimal_round(max_lon,4),
        "center":[decimal_round((min_lat+max_lat)/2.0,4),decimal_round((min_lon+max_lon)/2.0,4)]}},
        "grids":final_grids,"contourLines":contours,"drainagePolygons":layers["drainage_polygons"],
        "observationWells":layers["observation_wells"],"anomalies":anomalies}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn decimal_rounding_matches_binary_float_and_even_ties() {
        for (value, places, expected) in [
            (2.675, 2, 2.67),
            (1.125, 2, 1.12),
            (1.375, 2, 1.38),
            (-2.675, 2, -2.67),
            (0.0, 6, 0.0),
        ] {
            assert_eq!(decimal_round(value, places), expected);
        }
    }
    #[test]
    fn projection_has_expected_origin() {
        let (lon, lat) = CoordinateTransform::new()
            .unwrap()
            .lon_lat(1_000_000.0, 2_000_000.0)
            .unwrap();
        assert!((lon - 127.5).abs() < 1e-9);
        assert!((lat - 38.0).abs() < 1e-8);
    }
}
