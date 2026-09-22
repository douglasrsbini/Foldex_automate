use crate::models::OcrExtractionResult;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use zip::ZipArchive;

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "bmp", "tiff", "tif"];

pub fn extract_text_from_file(file_path: &Path) -> OcrExtractionResult {
    let path_str = file_path.to_string_lossy().to_string();

    if !file_path.exists() {
        return OcrExtractionResult {
            path: path_str,
            extracted_text: None,
            success: false,
            message: Some("Arquivo não encontrado para extração.".to_string()),
        };
    }

    let extension = file_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let is_pdf = extension == "pdf";
    let is_docx = extension == "docx";
    let is_image = IMAGE_EXTENSIONS.contains(&extension.as_str());

    if !is_pdf && !is_image && !is_docx {
        return OcrExtractionResult {
            path: path_str,
            extracted_text: None,
            success: false,
            message: Some("Formato não suportado para extração profunda (Use PDF, DOCX ou Imagens).".to_string()),
        };
    }

    let output = if is_pdf {
        // ⚡ LÊ O PDF MANTENDO AS COLUNAS (LAYOUT VISUAL) PARA A EXPORTAÇÃO CSV
        match extract_pdf_with_layout(file_path) {
            Ok(text) if text.trim().len() > 50 => Ok(text),
            _ => extract_pdf_text_heavy(file_path, None)
        }
    } else if is_docx {
        extract_docx_text(file_path)
    } else {
        run_tesseract(file_path)
    };

    match output {
        Ok(text) if text.trim().is_empty() => OcrExtractionResult {
            path: path_str,
            extracted_text: None,
            success: false,
            message: Some("Nenhum texto legível foi reconhecido no documento.".to_string()),
        },
        Ok(text) => OcrExtractionResult {
            path: path_str,
            extracted_text: Some(text),
            success: true,
            message: None,
        },
        Err(message) => OcrExtractionResult {
            path: path_str,
            extracted_text: None,
            success: false,
            message: Some(message),
        },
    }
}

pub fn file_content_matches_keyword(file_path: &Path, keyword: &str) -> bool {
    let extension = file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    
    if extension == "pdf" {
        if let Ok(text) = extract_pdf_with_layout(file_path) {
            if text.trim().len() > 50 {
                return text.to_lowercase().contains(&keyword.to_lowercase());
            }
        }
        return extract_pdf_text_heavy(file_path, Some(keyword))
            .unwrap_or_default()
            .to_lowercase()
            .contains(&keyword.to_lowercase());
    } else if extension == "docx" {
        return extract_docx_text(file_path)
            .unwrap_or_default()
            .to_lowercase()
            .contains(&keyword.to_lowercase());
    }

    if let Ok(text) = run_tesseract(file_path) {
        text.to_lowercase().contains(&keyword.to_lowercase())
    } else {
        false
    }
}

// ⚡ OTIMIZAÇÃO: Usa o pdftotext para ler o PDF respeitando espaços físicos (Ideal para exportar para Excel/Planilhas)
fn extract_pdf_with_layout(file_path: &Path) -> Result<String, String> {
    let output = Command::new(resolve_pdftotext_binary())
        .arg("-layout") // Parâmetro mágico que constrói o layout espacial 
        .arg("-enc")
        .arg("UTF-8")
        .arg(file_path)
        .arg("-")
        .output()
        .map_err(|_| "Motor pdftotext não encontrado no sistema.".to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Falha na extração de texto nativo do PDF.".to_string())
    }
}

fn extract_docx_text(file_path: &Path) -> Result<String, String> {
    let file = fs::File::open(file_path).map_err(|e| format!("Erro ao abrir o arquivo DOCX: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Erro ao descompactar a estrutura do DOCX: {}", e))?;
    
    let mut document_xml = archive.by_name("word/document.xml").map_err(|e| format!("O DOCX está corrompido ou vazio: {}", e))?;
    let mut xml_content = String::new();
    document_xml.read_to_string(&mut xml_content).map_err(|e| format!("Erro ao ler o texto interno: {}", e))?;
    
    let mut extracted = String::with_capacity(xml_content.len());
    let mut in_tag = false;
    let mut current_tag = String::new();

    for c in xml_content.chars() {
        if c == '<' {
            in_tag = true;
            current_tag.clear();
        } else if c == '>' {
            in_tag = false;
            // Quebra de linha ao fim de um parágrafo no Word
            if current_tag == "/w:p" {
                extracted.push('\n');
            }
        } else if in_tag {
            current_tag.push(c);
        } else {
            extracted.push(c);
        }
    }
    
    // Limpeza de caracteres especiais do XML (Unescape básico)
    let final_text = extracted
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'");

    Ok(final_text.trim().to_string())
}

fn run_tesseract(file_path: &Path) -> Result<String, String> {
    let output = Command::new(resolve_tesseract_binary())
        .arg(file_path)
        .arg("stdout")
        .arg("-l")
        .arg("por+eng")
        .output()
        .map_err(|_| "Motor OCR (Tesseract) não encontrado no sistema.".to_string())?;

    if !output.status.success() {
        return Err("Falha na extração de texto visual via OCR.".to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn extract_pdf_text_heavy(file_path: &Path, target_keyword: Option<&str>) -> Result<String, String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let temp_dir = std::env::temp_dir().join(format!("foldex-ocr-{}", timestamp));
    
    fs::create_dir_all(&temp_dir).map_err(|_| "Erro ao criar pasta temporária.")?;
    let output_prefix = temp_dir.join("page");

    let render_result = Command::new(resolve_pdftoppm_binary())
        .arg("-png")
        .arg("-r").arg("150")
        .arg("-f").arg("1")
        .arg("-l").arg("5")
        .arg(file_path)
        .arg(&output_prefix)
        .output();

    let result = match render_result {
        Ok(output) if output.status.success() => {
            let mut pages: Vec<PathBuf> = fs::read_dir(&temp_dir)
                .unwrap()
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| p.extension().map_or(false, |ext| ext == "png"))
                .collect();
            pages.sort();

            let mut texts = Vec::new();
            for page in pages {
                if let Ok(text) = run_tesseract(&page) {
                    let found_target = if let Some(kw) = target_keyword {
                        text.to_lowercase().contains(&kw.to_lowercase())
                    } else {
                        false
                    };

                    if !text.trim().is_empty() {
                        texts.push(text);
                    }

                    if found_target { break; }
                }
            }
            Ok(texts.join("\n\n"))
        }
        _ => Err("Falha ao renderizar PDF Escaneado (Poppler).".to_string()),
    };

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

// Resolução dos binários do Poppler
fn resolve_pdftoppm_binary() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let packages_dir = Path::new(&local_app_data).join("Microsoft\\WinGet\\Packages");
            if let Ok(entries) = fs::read_dir(packages_dir) {
                for entry in entries.filter_map(Result::ok) {
                    let candidate = entry.path().join("poppler-25.07.0\\Library\\bin\\pdftoppm.exe");
                    if candidate.exists() {
                        return candidate.to_string_lossy().to_string();
                    }
                }
            }
        }
    }
    "pdftoppm".to_string()
}

// ⚡ Resolução do Módulo Poppler (Extrator com Layout)
fn resolve_pdftotext_binary() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let packages_dir = Path::new(&local_app_data).join("Microsoft\\WinGet\\Packages");
            if let Ok(entries) = fs::read_dir(packages_dir) {
                for entry in entries.filter_map(Result::ok) {
                    let candidate = entry.path().join("poppler-25.07.0\\Library\\bin\\pdftotext.exe");
                    if candidate.exists() {
                        return candidate.to_string_lossy().to_string();
                    }
                }
            }
        }
    }
    "pdftotext".to_string()
}

fn resolve_tesseract_binary() -> String {
    #[cfg(target_os = "windows")]
    {
        let installed_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe";
        if Path::new(installed_path).exists() {
            return installed_path.to_string();
        }
    }
    "tesseract".to_string()
}