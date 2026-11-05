use anyhow::{ensure, Context, Result};
use clap::Parser;
use std::{
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Parser)]
#[command(version)]
#[command(
    about = "Generate retired synthetic examples from Head_05..09 SHP/DBF; never import 2025 source data"
)]
struct Args {
    #[arg(long, default_value = ".")]
    root: PathBuf,
    #[arg(long)]
    sample_dir: Option<PathBuf>,
    #[arg(long)]
    output: Option<PathBuf>,
}
fn absolute(path: &Path) -> Result<PathBuf> {
    let path = if path.is_absolute() {
        path.to_owned()
    } else {
        std::env::current_dir()?.join(path)
    };
    let mut normalized = PathBuf::new();
    for part in path.components() {
        match part {
            Component::ParentDir => {
                normalized.pop();
            }
            Component::CurDir => {}
            other => normalized.push(other.as_os_str()),
        }
    }
    let mut existing = normalized.as_path();
    let mut remainder = Vec::new();
    while !existing.exists() {
        remainder.push(
            existing
                .file_name()
                .context("Output has no existing parent")?
                .to_owned(),
        );
        existing = existing.parent().context("Output has no parent")?;
    }
    let mut resolved = fs::canonicalize(existing)?;
    for part in remainder.into_iter().rev() {
        resolved.push(part);
    }
    Ok(resolved)
}
fn run() -> Result<()> {
    let args = Args::parse();
    let root = absolute(&args.root)?;
    let output = absolute(
        &args
            .output
            .unwrap_or_else(|| root.join("output/sample-data/groundwater_sample.json")),
    )?;
    let active = absolute(&root.join("src/data/groundwater_data.json"))?;
    ensure!(
        !output
            .to_string_lossy()
            .eq_ignore_ascii_case(&active.to_string_lossy()),
        "Refusing to overwrite the active 2025 groundwater dataset with synthetic examples"
    );
    let input = args.sample_dir.unwrap_or_else(|| root.join("01_Sample"));
    let data = agriculture_tools::sample::generate(&input)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec(&data)?;
    let temporary = output.with_extension(format!("json.{}.tmp", std::process::id()));
    fs::write(&temporary, &bytes)?;
    fs::rename(&temporary, &output).with_context(|| format!("Save {}", output.display()))?;
    println!(
        "Generated {} synthetic example cells: {} ({} bytes)",
        data["grids"].as_array().unwrap().len(),
        output.display(),
        bytes.len()
    );
    Ok(())
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{error:#}");
        std::process::exit(1);
    }
}
