use crate::models::OcrExtractionResult;
use crate::services::ocr_engine;
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn extract_ocr_text_command(file_path: String) -> Result<OcrExtractionResult, String> {
    let path = PathBuf::from(&file_path);
    
    // Executa o OCR pesado numa thread separada para não travar a UI
    tokio::task::spawn_blocking(move || ocr_engine::extract_text_from_file(&path))
        .await
        .map_err(|e| format!("Erro crítico de concorrência no Rust: {}", e))
}

#[tauri::command]
pub async fn check_ocr_keyword_command(file_path: String, keyword: String) -> Result<bool, String> {
    let path = Path::new(&file_path).to_path_buf();

    tokio::task::spawn_blocking(move || ocr_engine::file_content_matches_keyword(&path, &keyword))
        .await
        .map_err(|e| format!("Erro crítico de concorrência no Rust: {}", e))
}