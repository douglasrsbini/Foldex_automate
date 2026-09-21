use crate::models::OcrExtractionResult;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "bmp", "tiff", "tif"];

/// Extrai texto de um arquivo (imagem ou PDF) usando o binário `tesseract` do sistema.
pub fn extract_text_from_file(file_path: &Path) -> OcrExtractionResult {
    let path_str = file_path.to_string_lossy().to_string();

    if !file_path.exists() {
        return OcrExtractionResult {
            path: path_str,
            extracted_text: None,
            success: false,
            message: Some("Arquivo não encontrado para extração OCR.".to_string()),
        };
    }

    let extension = file_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let is_pdf = extension == "pdf";
    let is_image = IMAGE_EXTENSIONS.contains(&extension.as_str());

    if !is_pdf && !is_image {
        return OcrExtractionResult {
            path: path_str,
            extracted_text: None,
            success: false,
            message: Some("Formato não suportado para OCR (apenas PDF e imagens).".to_string()),
        };
    }

    let output = if is_pdf {
        extract_pdf_text(file_path)
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

fn run_tesseract(file_path: &Path) -> Result<String, String> {
    let output = Command::new(resolve_tesseract_binary())
        .arg(file_path)
        .arg("stdout")
        .arg("-l")
        .arg("por+eng") // Suporte a Português e Inglês
        .output()
        .map_err(|_| {
            "Motor OCR (Tesseract) não encontrado no sistema. Instale o Tesseract OCR para habilitar este recurso.".to_string()
        })?;

    if !output.status.success() {
        return Err(format!(
            "Falha no motor OCR: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Rasteriza até dez páginas de um PDF com Poppler antes de enviá-las ao Tesseract.
fn extract_pdf_text(file_path: &Path) -> Result<String, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    
    let temp_dir = std::env::temp_dir().join(format!("foldex-ocr-{}", timestamp));
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Não foi possível preparar OCR do PDF: {}", e))?;
    
    let output_prefix = temp_dir.join("page");

    let render_result = Command::new(resolve_pdftoppm_binary())
        .arg("-png")
        .arg("-r")
        .arg("200") // Resolução ideal para OCR rápido
        .arg("-f")
        .arg("1")
        .arg("-l")
        .arg("10") // Limite de 10 páginas para não travar a máquina
        .arg(file_path)
        .arg(&output_prefix)
        .output();

    let result = match render_result {
        Ok(output) if output.status.success() => {
            let mut pages: Vec<PathBuf> = fs::read_dir(&temp_dir)
                .map_err(|e| e.to_string())?
                .filter_map(|entry| entry.ok().map(|e| e.path()))
                .filter(|path| path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("png")))
                .collect();
            
            pages.sort();

            let mut texts = Vec::new();
            for page in pages {
                if let Ok(text) = run_tesseract(&page) {
                    if !text.trim().is_empty() {
                        texts.push(text);
                    }
                }
            }
            Ok(texts.join("\n\n---\n\n"))
        }
        Ok(output) => Err(format!(
            "Falha ao preparar o PDF para OCR: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )),
        Err(_) => Err(
            "Renderizador de PDF (Poppler) não encontrado. Instale o Poppler para usar OCR em PDFs.".to_string(),
        ),
    };

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

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

pub fn file_content_matches_keyword(file_path: &Path, keyword: &str) -> bool {
    let result = extract_text_from_file(file_path);
    match result.extracted_text {
        Some(text) => text.to_lowercase().contains(&keyword.to_lowercase()),
        None => false,
    }
}