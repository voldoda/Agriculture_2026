//! Markdown source remains editable. PDFs use embedded Korean TrueType subsets.
use anyhow::{ensure, Context, Result};
use printpdf::*;
use std::{fs, path::Path};

const WIDTH: f64 = 595.275_590_551_181_2;
const HEIGHT: f64 = 841.889_763_779_527_7;
const LEFT: f64 = 46.0;
const CONTENT: f64 = 503.0;

#[derive(Debug, PartialEq)]
pub enum Block {
    Paragraph(String),
    Heading(String),
    Table(Vec<Vec<String>>),
}
#[derive(Debug, PartialEq)]
pub struct Page {
    pub title: String,
    pub blocks: Vec<Block>,
}

fn flush(blocks: &mut Vec<Block>, paragraph: &mut Vec<String>, table: &mut Vec<Vec<String>>) {
    if !paragraph.is_empty() {
        blocks.push(Block::Paragraph(paragraph.join(" ")));
        paragraph.clear();
    }
    if !table.is_empty() {
        blocks.push(Block::Table(std::mem::take(table)));
    }
}

pub fn parse_markdown(text: &str) -> Result<Vec<Page>> {
    let mut pages = Vec::new();
    for chunk in text
        .trim_start_matches('\u{feff}')
        .split("<!-- pagebreak -->")
    {
        let mut title = None;
        let mut blocks = Vec::new();
        let mut paragraph = Vec::new();
        let mut table = Vec::new();
        for line in chunk.lines().map(str::trim) {
            if line.starts_with("<!--") {
                continue;
            }
            if line.is_empty() {
                flush(&mut blocks, &mut paragraph, &mut table);
            } else if let Some(value) = line.strip_prefix("# ") {
                flush(&mut blocks, &mut paragraph, &mut table);
                ensure!(
                    title.is_none(),
                    "Use <!-- pagebreak --> between page titles"
                );
                title = Some(value.to_owned());
            } else if let Some(value) = line.strip_prefix("## ") {
                flush(&mut blocks, &mut paragraph, &mut table);
                blocks.push(Block::Heading(value.to_owned()));
            } else if line.starts_with('|') && line.ends_with('|') {
                if !paragraph.is_empty() {
                    flush(&mut blocks, &mut paragraph, &mut table);
                }
                let cells: Vec<String> = line[1..line.len() - 1]
                    .split('|')
                    .map(|s| s.trim().to_owned())
                    .collect();
                if !cells
                    .iter()
                    .all(|s| s.chars().all(|c| matches!(c, '-' | ':' | ' ')))
                {
                    table.push(cells);
                }
            } else {
                if !table.is_empty() {
                    flush(&mut blocks, &mut paragraph, &mut table);
                }
                paragraph.push(line.to_owned());
            }
        }
        flush(&mut blocks, &mut paragraph, &mut table);
        if let Some(title) = title {
            pages.push(Page { title, blocks });
        } else {
            ensure!(blocks.is_empty(), "A page needs a # title");
        }
    }
    ensure!(!pages.is_empty(), "Markdown has no page titles");
    for page in &pages {
        for block in &page.blocks {
            if let Block::Table(rows) = block {
                let cols = rows[0].len();
                ensure!((2..=3).contains(&cols), "Tables must have 2 or 3 columns");
                ensure!(
                    rows.iter().all(|row| row.len() == cols),
                    "Table columns do not match on {}",
                    page.title
                );
            }
        }
    }
    Ok(pages)
}

struct Font<'a> {
    id: FontId,
    face: ttf_parser::Face<'a>,
}
impl Font<'_> {
    fn width(&self, text: &str, size: f64) -> Result<f64> {
        let mut units = 0u64;
        for ch in text.chars() {
            let glyph = self.face.glyph_index(ch).with_context(|| {
                format!(
                    "Font cannot display {ch:?} (U+{:04X}); choose a complete Korean TTF font",
                    u32::from(ch)
                )
            })?;
            units += u64::from(self.face.glyph_hor_advance(glyph).unwrap_or(0));
        }
        Ok(units as f64 / f64::from(self.face.units_per_em()) * size)
    }
    fn wrap(&self, text: &str, size: f64, width: f64) -> Result<Vec<String>> {
        let mut lines = Vec::new();
        let mut current = String::new();
        let mut start = 0;
        for (end, _) in unicode_linebreak::linebreaks(text) {
            let piece = &text[start..end];
            start = end;
            let candidate = format!("{current}{piece}");
            if self.width(candidate.trim_end(), size)? > width && !current.is_empty() {
                lines.push(current.trim_end().to_owned());
                current.clear();
            }
            let piece = if current.is_empty() {
                piece.trim_start()
            } else {
                piece
            };
            // Unicode line breaks keep punctuation and ordinary words together.
            // Only an individual token wider than the column needs a character fallback.
            for ch in piece.chars() {
                let candidate = format!("{current}{ch}");
                if self.width(candidate.trim_end(), size)? > width && !current.is_empty() {
                    lines.push(current.trim_end().to_owned());
                    current.clear();
                }
                current.push(ch);
            }
        }
        if !current.is_empty() {
            lines.push(current.trim_end().to_owned());
        }
        if lines.is_empty() {
            lines.push(String::new());
        }
        Ok(lines)
    }
}

fn color(r: f64, g: f64, b: f64) -> Color {
    Color::Rgb(Rgb::new(r as f32, g as f32, b as f32, None))
}
fn point(x: f64, y: f64) -> Point {
    Point {
        x: Pt(x as f32),
        y: Pt((HEIGHT - y) as f32),
    }
}
fn text(
    ops: &mut Vec<Op>,
    font: &Font<'_>,
    value: &str,
    size: f64,
    x: f64,
    baseline: f64,
    col: Color,
) {
    ops.extend([
        Op::StartTextSection,
        Op::SetFillColor { col },
        Op::SetFontSize {
            size: Pt(size as f32),
            font: font.id.clone(),
        },
        Op::SetTextCursor {
            pos: point(x, baseline),
        },
        Op::WriteText {
            items: vec![TextItem::Text(value.to_owned())],
            font: font.id.clone(),
        },
        Op::EndTextSection,
    ]);
}
fn room(y: f64, need: f64, title: &str) -> Result<()> {
    ensure!(
        y + need <= HEIGHT - 49.0,
        "Page {title:?} overflows by {:.1}pt; add <!-- pagebreak --> or shorten the page",
        (y + need) - (HEIGHT - 49.0)
    );
    Ok(())
}
fn paragraph(
    ops: &mut Vec<Op>,
    font: &Font<'_>,
    value: &str,
    style: (f64, f64, f64),
    y: &mut f64,
    title: &str,
) -> Result<()> {
    let (size, leading, after) = style;
    let lines = font.wrap(value, size, CONTENT)?;
    room(*y, lines.len() as f64 * leading + after, title)?;
    for line in lines {
        text(
            ops,
            font,
            &line,
            size,
            LEFT,
            *y + size,
            color(0.09, 0.13, 0.18),
        );
        *y += leading;
    }
    *y += after;
    Ok(())
}

pub fn render(
    pages: &[Page],
    quick: bool,
    font_path: &Path,
    bold_path: &Path,
    version: &str,
    date: &str,
) -> Result<Vec<u8>> {
    ensure!(!pages.is_empty(), "No pages");
    let regular_bytes =
        fs::read(font_path).with_context(|| format!("Read font {}", font_path.display()))?;
    let bold_bytes =
        fs::read(bold_path).with_context(|| format!("Read font {}", bold_path.display()))?;
    let mut doc = PdfDocument::new(&format!("{} - Agriculture 2026 v{version}", pages[0].title));
    doc.metadata.info.author = "Agriculture 2026".into();
    doc.metadata.info.subject = "유구천 유역 지하수 모니터링 시연 안내".into();
    let mut warnings = Vec::new();
    let parsed = ParsedFont::from_bytes(&regular_bytes, 0, &mut warnings)
        .context("Cannot parse regular TrueType font")?;
    let parsed_bold = ParsedFont::from_bytes(&bold_bytes, 0, &mut warnings)
        .context("Cannot parse bold TrueType font")?;
    let regular = Font {
        id: doc.add_font(&parsed),
        face: ttf_parser::Face::parse(&regular_bytes, 0).map_err(|e| anyhow::anyhow!("{e:?}"))?,
    };
    let bold = Font {
        id: doc.add_font(&parsed_bold),
        face: ttf_parser::Face::parse(&bold_bytes, 0).map_err(|e| anyhow::anyhow!("{e:?}"))?,
    };
    let mut pdf_pages = Vec::new();
    for (pi, page) in pages.iter().enumerate() {
        let mut ops = Vec::new();
        let mut y = 48.0;
        text(
            &mut ops,
            &regular,
            &format!("AGRICULTURE 2026  |  v{version}  |  시연 안내"),
            8.0,
            LEFT,
            30.0,
            color(0.337, 0.396, 0.475),
        );
        paragraph(
            &mut ops,
            &bold,
            &page.title,
            (21.0, 29.0, 14.0),
            &mut y,
            &page.title,
        )?;
        for block in &page.blocks {
            match block {
                Block::Paragraph(value) => paragraph(
                    &mut ops,
                    &regular,
                    value,
                    (
                        if quick { 9.8 } else { 10.5 },
                        if quick { 14.3 } else { 16.3 },
                        8.0,
                    ),
                    &mut y,
                    &page.title,
                )?,
                Block::Heading(value) => {
                    y += 8.0;
                    paragraph(
                        &mut ops,
                        &bold,
                        value,
                        (12.0, 18.0, 7.0),
                        &mut y,
                        &page.title,
                    )?;
                }
                Block::Table(rows) => {
                    let widths: Vec<f64> = if quick && pi == 0 {
                        vec![64.0, 244.0, 195.0]
                    } else if rows[0].len() == 2 {
                        vec![90.0, 413.0]
                    } else {
                        vec![85.0, 110.0, 308.0]
                    };
                    let size = if quick { 8.8 } else { 9.4 };
                    let leading = if quick { 12.8 } else { 14.2 };
                    for (ri, row) in rows.iter().enumerate() {
                        let font = if ri == 0 { &bold } else { &regular };
                        let wrapped: Vec<Vec<String>> = row
                            .iter()
                            .zip(&widths)
                            .map(|(value, width)| font.wrap(value, size, width - 14.0))
                            .collect::<Result<_>>()?;
                        let height =
                            wrapped.iter().map(Vec::len).max().unwrap_or(1) as f64 * leading + 12.0;
                        room(y, height, &page.title)?;
                        let mut x = LEFT;
                        for (lines, width) in wrapped.iter().zip(&widths) {
                            ops.extend([
                                Op::SetFillColor {
                                    col: if ri == 0 {
                                        color(0.91, 0.933, 0.953)
                                    } else {
                                        color(1.0, 1.0, 1.0)
                                    },
                                },
                                Op::SetOutlineColor {
                                    col: color(0.804, 0.835, 0.867),
                                },
                                Op::SetOutlineThickness { pt: Pt(0.5) },
                                Op::DrawPolygon {
                                    polygon: Polygon {
                                        rings: vec![PolygonRing {
                                            points: [
                                                point(x, y),
                                                point(x + width, y),
                                                point(x + width, y + height),
                                                point(x, y + height),
                                            ]
                                            .into_iter()
                                            .map(|p| LinePoint { p, bezier: false })
                                            .collect(),
                                        }],
                                        mode: PaintMode::FillStroke,
                                        winding_order: WindingOrder::NonZero,
                                    },
                                },
                            ]);
                            for (index, line) in lines.iter().enumerate() {
                                text(
                                    &mut ops,
                                    font,
                                    line,
                                    size,
                                    x + 7.0,
                                    y + 6.0 + size + index as f64 * leading,
                                    color(0.09, 0.13, 0.18),
                                );
                            }
                            x += width;
                        }
                        y += height;
                    }
                    y += 10.0;
                }
            }
        }
        ops.extend([
            Op::SetOutlineColor {
                col: color(0.8, 0.831, 0.863),
            },
            Op::SetOutlineThickness { pt: Pt(0.5) },
            Op::DrawLine {
                line: Line {
                    points: [
                        point(LEFT, HEIGHT - 39.0),
                        point(WIDTH - LEFT, HEIGHT - 39.0),
                    ]
                    .into_iter()
                    .map(|p| LinePoint { p, bezier: false })
                    .collect(),
                    is_closed: false,
                },
            },
        ]);
        text(
            &mut ops,
            &regular,
            &format!("기준일 {date}  |  2025년 월말 수위"),
            8.0,
            LEFT,
            HEIGHT - 26.0,
            color(0.337, 0.396, 0.475),
        );
        let number = format!("{} / {}", pi + 1, pages.len());
        let number_x = WIDTH - LEFT - regular.width(&number, 8.0)?;
        text(
            &mut ops,
            &regular,
            &number,
            8.0,
            number_x,
            HEIGHT - 26.0,
            color(0.337, 0.396, 0.475),
        );
        pdf_pages.push(PdfPage::new(Mm(210.0), Mm(297.0), ops));
    }
    Ok(doc
        .with_pages(pdf_pages)
        .save(&PdfSaveOptions::default(), &mut warnings))
}

pub fn document_metadata(markdown: &str) -> (&str, &str) {
    let first = markdown.lines().next().unwrap_or("");
    let version = first
        .split(" v")
        .nth(1)
        .and_then(|s| s.split(';').next())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("1.0.0");
    let date = first
        .split("기준일 ")
        .nth(1)
        .and_then(|s| s.split(';').next())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("2026-10-29");
    (version, date)
}

pub fn ensure_default_source(path: &Path, template: &str, reset: bool) -> Result<String> {
    if reset || !path.exists() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, template)?;
    }
    fs::read_to_string(path).with_context(|| format!("Read Markdown {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn markdown_preserves_tables_pages_and_korean_formula() {
        let pages=parse_markdown("# 하나\n\n본문\n줄\n\n| 식 | 값 |\n|---|---|\n| 최고-현재 | 5m |\n<!-- pagebreak -->\n# 둘\n## 제목").unwrap();
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].blocks[0], Block::Paragraph("본문 줄".into()));
        assert_eq!(
            pages[0].blocks[1],
            Block::Table(vec![
                vec!["식".into(), "값".into()],
                vec!["최고-현재".into(), "5m".into()]
            ])
        );
    }
    #[test]
    fn malformed_tables_and_missing_page_titles_are_errors() {
        assert!(parse_markdown("# 제목\n|a|b|\n|1|2|3|").is_err());
        assert!(parse_markdown("제목 없는 글").is_err());
        assert!(room(790.0, 30.0, "긴 문서").is_err());
    }
    #[test]
    fn default_templates_keep_six_and_two_pages() {
        for (source, count) in [
            (include_str!("../assets/최종_시연대본.md"), 6),
            (include_str!("../assets/최종_조작표.md"), 2),
        ] {
            assert_eq!(parse_markdown(source).unwrap().len(), count);
            assert_eq!(document_metadata(source), ("1.0.0", "2026-10-29"));
        }
    }
}
