use anyhow::{Context, Result};
use clap::Parser;
use std::{fs, path::PathBuf};

#[derive(Parser)]
#[command(version)]
#[command(about = "Render editable Korean demo Markdown to PDF using Rust (no Python)")]
struct Args {
    #[arg(long, default_value = ".")]
    root: PathBuf,
    #[arg(long, env = "DEMO_FONT", default_value = "C:/Windows/Fonts/malgun.ttf")]
    font: PathBuf,
    #[arg(
        long,
        env = "DEMO_BOLD_FONT",
        default_value = "C:/Windows/Fonts/malgunbd.ttf"
    )]
    bold_font: PathBuf,
    #[arg(long)]
    output_dir: Option<PathBuf>,
    #[arg(long)]
    reset_source: bool,
}
fn run() -> Result<()> {
    let args = Args::parse();
    let source_dir = args.root.join("docs/demo");
    let output_dir = args.output_dir.unwrap_or_else(|| source_dir.clone());
    let mut pending = Vec::new();
    let mut counts = Vec::new();
    for (name, default, quick) in [
        (
            "최종_시연대본",
            include_str!("../../assets/최종_시연대본.md"),
            false,
        ),
        (
            "최종_조작표",
            include_str!("../../assets/최종_조작표.md"),
            true,
        ),
    ] {
        let markdown = agriculture_tools::demo::ensure_default_source(
            &source_dir.join(format!("{name}.md")),
            default,
            args.reset_source,
        )?;
        let pages = agriculture_tools::demo::parse_markdown(&markdown)?;
        let (version, date) = agriculture_tools::demo::document_metadata(&markdown);
        let bytes = agriculture_tools::demo::render(
            &pages,
            quick,
            &args.font,
            &args.bold_font,
            version,
            date,
        )?;
        pending.push((name, bytes));
        counts.push((name, pages.len()));
    }
    fs::create_dir_all(&output_dir)?;
    for (name, bytes) in pending {
        let dest = output_dir.join(format!("{name}.pdf"));
        let temp = dest.with_extension(format!("pdf.{}.tmp", std::process::id()));
        fs::write(&temp, bytes)?;
        fs::rename(&temp, &dest).with_context(|| format!("Save {}", dest.display()))?;
    }
    println!("{}", serde_json::to_string(&counts)?);
    Ok(())
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{error:#}");
        std::process::exit(1);
    }
}
