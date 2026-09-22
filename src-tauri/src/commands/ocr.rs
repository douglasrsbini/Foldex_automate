use crate::models::OcrExtractionResult;
use crate::services::ocr_engine;
use std::path::{Path, PathBuf};
use std::process::Command; // ⚡ Importação adicionada para rodar os comandos do Poppler

#[tauri::command]
pub async fn extract_ocr_text_command(file_path: String) -> Result<OcrExtractionResult, String> {
    let path = PathBuf::from(&file_path);
    
    tokio::task::spawn_blocking(move || ocr_engine::extract_text_from_file(&path))
        .await
        .map_err(|e| format!("Erro interno ao processar Extração: {}", e))
}

#[tauri::command]
pub async fn check_ocr_keyword_command(file_path: String, keyword: String) -> Result<bool, String> {
    let path = Path::new(&file_path).to_path_buf();

    tokio::task::spawn_blocking(move || ocr_engine::file_content_matches_keyword(&path, &keyword))
        .await
        .map_err(|e| format!("Erro crítico de concorrência no Rust: {}", e))
}

// ⚡ Comando para gerar e exportar arquivos (Convertidos)
#[tauri::command]
pub async fn export_text_to_file_command(text: String, dest_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        std::fs::write(&dest_path, text).map_err(|e| format!("Erro ao criar arquivo: {}", e))
    })
    .await
    .map_err(|e| format!("Erro crítico do SO: {}", e))?
    .map(|_| "Arquivo exportado com sucesso.".to_string())
}

// =====================================================================
// ⚡ NOVOS COMANDOS: MANIPULAÇÃO NATIVA DE PDF (POPPLER)
// =====================================================================

fn resolve_poppler_tool(tool_name: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let packages_dir = Path::new(&local_app_data).join("Microsoft\\WinGet\\Packages");
            if let Ok(entries) = std::fs::read_dir(packages_dir) {
                for entry in entries.filter_map(Result::ok) {
                    let candidate = entry.path().join(format!("poppler-25.07.0\\Library\\bin\\{}.exe", tool_name));
                    if candidate.exists() {
                        return candidate.to_string_lossy().to_string();
                    }
                }
            }
        }
    }
    tool_name.to_string()
}

#[tauri::command]
pub async fn merge_pdfs_command(file_paths: Vec<String>, output_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(resolve_poppler_tool("pdfunite"));
        
        for path in file_paths {
            cmd.arg(path);
        }
        cmd.arg(&output_path);

        let output = cmd.output().map_err(|e| format!("Erro ao iniciar pdfunite: {}", e))?;
        if output.status.success() {
            Ok(format!("PDFs mesclados com sucesso em:\n{}", output_path))
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn split_pdf_command(file_path: String, output_dir: String, prefix: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let out_pattern = Path::new(&output_dir).join(format!("{}-%d.pdf", prefix));
        let mut cmd = Command::new(resolve_poppler_tool("pdfseparate"));
        
        cmd.arg(&file_path);
        cmd.arg(out_pattern.to_string_lossy().to_string());

        let output = cmd.output().map_err(|e| format!("Erro ao iniciar pdfseparate: {}", e))?;
        if output.status.success() {
            Ok("PDF separado com sucesso! Páginas extraídas na pasta selecionada.".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }).await.map_err(|e| e.to_string())?
}

// =====================================================================
// ⚡ AUTOMAÇÃO DE SISTEMA (CONVERSÕES WORD E IMPRESSÃO)
// =====================================================================

// ⚡ COMANDO PARA CONVERTER DOCX EM PDF (Automação do MS Word via Windows COM)
#[tauri::command]
pub async fn convert_docx_to_pdf_command(source_path: String, dest_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Usando r#"..."# o Rust ignora barras invertidas e caracteres especiais
        let script = format!(
            r#"
            $word = New-Object -ComObject Word.Application
            $word.Visible = $false
            $doc = $word.Documents.Open('{}')
            $doc.SaveAs('{}', 17)
            $doc.Close($false)
            $word.Quit()
            "#,
            source_path.replace("'", "''"), 
            dest_path.replace("'", "''")
        );

        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("Falha ao invocar o sistema operacional: {}", e))?;

        if output.status.success() {
            Ok(format!("Documento convertido com layout perfeito e salvo em:\n{}", dest_path))
        } else {
            let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
            if error_msg.contains("Word.Application") {
                Err("Microsoft Word não encontrado nesta máquina para realizar a conversão de layout.".to_string())
            } else {
                Err(format!("Erro na conversão: {}", error_msg))
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ⚡ COMANDO PARA CONVERTER PDF EM DOCX
#[tauri::command]
pub async fn convert_pdf_to_docx_command(source_path: String, dest_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let script = format!(
            r#"
            $word = New-Object -ComObject Word.Application
            $word.Visible = $false
            $word.DisplayAlerts = 0
            $doc = $word.Documents.Open('{}', $false, $false)
            $doc.SaveAs('{}', 16)
            $doc.Close($false)
            $word.Quit()
            "#,
            source_path.replace("'", "''"), 
            dest_path.replace("'", "''")
        );

        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("Falha ao invocar o sistema operacional: {}", e))?;

        if output.status.success() {
            Ok(format!("PDF convertido para Word com sucesso e salvo em:\n{}", dest_path))
        } else {
            let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("Erro na conversão: {}", error_msg))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ⚡ COMANDO PARA IMPRESSÃO COM TELA DE SELEÇÃO NATIVA
#[tauri::command]
pub async fn print_document_command(file_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Usamos Raw Strings (r#"..."#) para o Rust não tentar interpretar barras ou cifrões.
        // Mantemos os pontos e vírgulas (;) para o PowerShell executar tudo na perfeição.
        let script = format!(
            r#"
            Add-Type -AssemblyName System.Windows.Forms;
            $dialog = New-Object System.Windows.Forms.PrintDialog;
            $dialog.UseEXDialog =$true;
            $topForm = New-Object System.Windows.Forms.Form;
            $topForm.TopMost =$true;
            $topForm.ShowInTaskbar =$false;
            $topForm.WindowState = 'Minimized';
            $topForm.Show();$topForm.Focus();
            $result =$dialog.ShowDialog($topForm);$topForm.Dispose();
            if ($result -eq 'OK') {{
                $printer =$dialog.PrinterSettings.PrinterName;
                Start-Process -FilePath '{}' -Verb PrintTo -ArgumentList "`"$printer`"" -PassThru | %{{ Sleep 5; $_.Kill() }};
                Write-Output 'OK';
            }} else {{
                Write-Output 'CANCELADO';
            }}
            "#,
            file_path.replace("'", "''")
        );

        let output = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("Falha ao invocar o sistema de impressão: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if stdout.contains("OK") {
            Ok("Documento enviado para a impressora com sucesso!".to_string())
        } else if stdout.contains("CANCELADO") {
            Ok("Impressão cancelada pelo utilizador.".to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(format!("Falha na comunicação com a impressora: {}\n{}", stdout, stderr))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ⚡ NOVO: COMANDO PARA EXPORTAR TEXTO DIRETAMENTE PARA DOCX OU PDF
#[tauri::command]
pub async fn export_text_to_word_pdf_command(text: String, dest_path: String, as_pdf: bool) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        use std::env;
        use std::fs;
        use std::process::Command;
        use std::time::{SystemTime, UNIX_EPOCH};

        // 1. Cria um arquivo temporário seguro para evitar problemas de caracteres/quebra de linha no PowerShell
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
        let temp_txt = env::temp_dir().join(format!("foldex_temp_{}.txt", timestamp));
        
        fs::write(&temp_txt, &text).map_err(|e| format!("Erro ao criar arquivo temporário: {}", e))?;
        
        let format_code = if as_pdf { 17 } else { 16 };
        let temp_txt_path = temp_txt.to_string_lossy().replace("'", "''");
        let dest_path_safe = dest_path.replace("'", "''");

        // 2. Aciona o Word via COM para abrir o .txt e Salvar Como .docx ou .pdf
        let script = format!(
            r#"
            $word = New-Object -ComObject Word.Application;
            $word.Visible = $false;
            $word.DisplayAlerts = 0;
            $doc = $word.Documents.Open('{}', $false, $false);
            $doc.SaveAs('{}', {});
            $doc.Close($false);
            $word.Quit();
            "#,
            temp_txt_path, dest_path_safe, format_code
        );

        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", &script])
            .output();

        // 3. Limpa o rastro apagando o arquivo temporário (independentemente se deu erro ou não)
        let _ = fs::remove_file(&temp_txt);

        let out = output.map_err(|e| format!("Falha ao invocar o sistema operacional: {}", e))?;

        if out.status.success() {
            let doc_type = if as_pdf { "PDF" } else { "Word (.docx)" };
            Ok(format!("Texto exportado com sucesso para {}!", doc_type))
        } else {
            let error_msg = String::from_utf8_lossy(&out.stderr).to_string();
            Err(format!("Erro na exportação rica: {}", error_msg))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}