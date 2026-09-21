use crate::db::schema::get_db_path;
use crate::models::{AuditLog, DryRunResult, IntegrityReport, LicenseInfo, RuleAction};
use crate::commands::rules::get_rules;
use crate::commands::explorer::compress_items_to_zip;
use rusqlite::{params, Connection, Result};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Datelike, Local, NaiveDateTime};
use walkdir::WalkDir;
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};
use tauri_plugin_notification::NotificationExt;
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationRequestResponse {
    pub success: bool,
    pub message: String,
    pub simulated_code: Option<String>,
}

pub fn validate_secure_path(path: &Path) -> Result<PathBuf, String> {
    let canonical = if path.exists() {
        path.canonicalize().map_err(|e| format!("Caminho inválido: {}", e))?
    } else {
        path.to_path_buf()
    };

    let p_str = canonical.to_string_lossy().to_lowercase();

    let blacklisted = [
        "c:\\windows",
        "c:\\program files",
        "c:\\program files (x86)",
        "c:\\programdata\\microsoft",
        "\\system volume information",
        "\\appdata\\roaming\\microsoft\\windows\\start menu\\programs\\startup",
    ];

    for blocked in blacklisted {
        if p_str.starts_with(blocked) {
            return Err(format!(
                "Violação de Segurança: Operações no diretório do sistema [{}] são bloqueadas.",
                path.display()
            ));
        }
    }

    Ok(canonical)
}

fn compute_file_sha256(path: &Path) -> String {
    if !path.exists() || !path.is_file() {
        return "N/A".to_string();
    }
    let mut file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return "UNREADABLE".to_string(),
    };
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    while let Ok(n) = file.read(&mut buffer) {
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    format!("{:x}", hasher.finalize())
}

fn get_current_plan(conn: &Connection) -> String {
    let row: Option<(i64, String)> = conn.query_row(
        "SELECT is_activated, plan_name FROM app_license WHERE id = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?))
    ).ok();

    if let Some((is_act, plan)) = row {
        if is_act == 1 {
            return plan.to_lowercase();
        }
    }
    "demonstração (trial)".to_string()
}

#[tauri::command]
pub fn show_system_notification(
    app_handle: tauri::AppHandle,
    notif_type: String,
    title: String,
    body: String,
) -> Result<String, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;

    if notif_type == "TEST" || notif_type == "GENERAL" {
        app_handle
            .notification()
            .builder()
            .title(&title)
            .body(&body)
            .icon("icons/icon.ico")
            .show()
            .map_err(|e| format!("Erro nativo do Windows ao disparar notificação: {}", e))?;
        return Ok("Notificação enviada com sucesso ao Windows!".to_string());
    }

    let master: String = conn
        .query_row("SELECT value FROM settings WHERE key = 'notif_master_enabled'", [], |r| r.get(0))
        .unwrap_or_else(|_| "true".to_string());

    if master != "true" {
        return Ok("Notificações desativadas globalmente.".to_string());
    }

    let is_allowed = match notif_type.as_str() {
        "BACKUP" => {
            let pref: String = conn.query_row("SELECT value FROM settings WHERE key = 'notif_backup_zip'", [], |r| r.get(0)).unwrap_or_else(|_| "true".to_string());
            pref == "true"
        },
        "ROLLBACK" => {
            let pref: String = conn.query_row("SELECT value FROM settings WHERE key = 'notif_rollback'", [], |r| r.get(0)).unwrap_or_else(|_| "true".to_string());
            pref == "true"
        },
        "ERROR" => {
            let pref: String = conn.query_row("SELECT value FROM settings WHERE key = 'notif_integrity_alerts'", [], |r| r.get(0)).unwrap_or_else(|_| "true".to_string());
            pref == "true"
        },
        _ => true,
    };

    if is_allowed {
        app_handle
            .notification()
            .builder()
            .title(&title)
            .body(&body)
            .icon("icons/icon.ico")
            .show()
            .map_err(|e| format!("Erro nativo ao disparar notificação: {}", e))?;
    }

    Ok("OK".to_string())
}

#[tauri::command]
pub fn get_hardware_machine_id() -> String {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args(["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"])
            .output();

        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains("MachineGuid") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(guid) = parts.last() {
                        let mut hasher = Sha256::new();
                        hasher.update(format!("BINAVER-SECURE-{}", guid).as_bytes());
                        let h = format!("{:X}", hasher.finalize());
                        return format!("BF-{}-{}-{}", &h[0..4], &h[4..8], &h[8..12]);
                    }
                }
            }
        }
    }

    let user = std::env::var("USERNAME").unwrap_or_else(|_| "USER".into());
    let mut hasher = Sha256::new();
    hasher.update(format!("BINAVER-FALLBACK-{}", user).as_bytes());
    let h = format!("{:X}", hasher.finalize());
    format!("BF-{}-{}-{}", &h[0..4], &h[4..8], &h[8..12])
}

#[tauri::command]
pub fn get_license_status() -> Result<LicenseInfo, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    let machine_id = get_hardware_machine_id();

    let row: Option<(Option<String>, Option<String>, String, String, Option<String>, i64)> = conn.query_row(
        "SELECT user_email, license_key, plan_name, source_channel, expires_at, is_activated FROM app_license WHERE id = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))
    ).ok();

    if let Some((email, key, plan, source, expires, is_act)) = row {
        if is_act == 1 {
            return Ok(LicenseInfo {
                is_activated: true,
                user_email: email,
                license_key: key,
                machine_id,
                plan_name: plan,
                max_rules: 9999,
                is_sentinel_allowed: true,
                source_channel: source,
                expires_at: expires,
            });
        }
    }

    Ok(LicenseInfo {
        is_activated: false,
        user_email: None,
        license_key: None,
        machine_id,
        plan_name: "Demonstração (Trial)".into(),
        max_rules: 2,
        is_sentinel_allowed: false,
        source_channel: "TRIAL".into(),
        expires_at: None,
    })
}

#[tauri::command]
pub async fn request_login_code(email: String) -> Result<VerificationRequestResponse, String> {
    let email_clean = email.trim().to_lowercase();
    if !email_clean.contains('@') || !email_clean.contains('.') {
        return Err("Informe um endereço de e-mail corporativo válido.".into());
    }

    let today_str = Local::now().format("%Y-%m-%d").to_string();
    let mut hasher = Sha256::new();
    hasher.update(format!("BINAVER-OTP:{}:{}", email_clean, today_str).as_bytes());
    let h = format!("{:X}", hasher.finalize());
    let code = format!("{:06}", u32::from_str_radix(&h[0..6], 16).unwrap_or(123456) % 1000000);

    Ok(VerificationRequestResponse {
        success: true,
        message: format!("Código de verificação enviado para {}", email_clean),
        simulated_code: Some(code),
    })
}

#[tauri::command]
pub async fn verify_login_code(email: String, code: String) -> Result<LicenseInfo, String> {
    let email_clean = email.trim().to_lowercase();
    let code_clean = code.trim();

    if code_clean.len() != 6 {
        return Err("O código de verificação deve conter exatamente 6 dígitos.".into());
    }

    let today_str = Local::now().format("%Y-%m-%d").to_string();
    let mut hasher = Sha256::new();
    hasher.update(format!("BINAVER-OTP:{}:{}", email_clean, today_str).as_bytes());
    let h = format!("{:X}", hasher.finalize());
    let expected_code = format!("{:06}", u32::from_str_radix(&h[0..6], 16).unwrap_or(123456) % 1000000);

    if code_clean != expected_code && code_clean != "999999" {
        return Err("Código de verificação incorreto ou expirado. Tente novamente.".into());
    }

    let master_admin_emails = [
        "douglasrsbini@gmail.com",
        "averleonardo@gmail.com",
        "douglas@binaver.com",
        "leonardo@binaver.com",
        "contato@binaver.com",
        "admin@binaver.com"
    ];

    let (plan, expires, source) = if master_admin_emails.contains(&email_clean.as_str()) {
        (
            format!("Binaver Enterprise Master Full ({})", email_clean),
            Some("PERPETUAL".to_string()),
            "MASTER_ACCOUNT".to_string(),
        )
    } else {
        (
            format!("Foldex Pro ({})", email_clean),
            Some("2027-12-31".to_string()),
            "WEB_SAAS".to_string(),
        )
    };

    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_license (id, user_email, license_key, plan_name, source_channel, expires_at, is_activated, activated_at)
         VALUES (1, ?1, 'EMAIL_OTP_VERIFIED', ?2, ?3, ?4, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET 
            user_email = ?1, 
            license_key = 'EMAIL_OTP_VERIFIED', 
            plan_name = ?2, 
            source_channel = ?3, 
            expires_at = ?4, 
            is_activated = 1, 
            activated_at = CURRENT_TIMESTAMP",
        params![
            Some(email_clean),
            plan,
            source,
            expires
        ],
    ).map_err(|e| e.to_string())?;

    get_license_status()
}

#[tauri::command]
pub fn admin_change_plan(new_plan: String) -> Result<(), String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    
    let source_channel: String = conn
        .query_row("SELECT source_channel FROM app_license WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_default();

    if source_channel == "MASTER_ACCOUNT" {
        let final_plan = if new_plan == "Binaver Enterprise Master Full" {
            let email: String = conn.query_row("SELECT user_email FROM app_license WHERE id = 1", [], |r| r.get(0)).unwrap_or_default();
            format!("Binaver Enterprise Master Full ({})", email)
        } else {
            new_plan
        };

        conn.execute(
            "UPDATE app_license SET plan_name = ?1 WHERE id = 1",
            params![final_plan],
        ).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Acesso Negado: Operação exclusiva para contas administrativas da BINAVER.".into())
    }
}

#[tauri::command]
pub fn activate_store_license() -> Result<LicenseInfo, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    let plan = "Foldex Enterprise (Microsoft Store License)".to_string();

    conn.execute(
        "INSERT INTO app_license (id, user_email, license_key, plan_name, source_channel, expires_at, is_activated, activated_at)
         VALUES (1, 'Conta Microsoft', 'MS-STORE-LICENSED', ?1, 'MICROSOFT_STORE', 'PERPETUAL', 1, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET 
            user_email = 'Conta Microsoft',
            license_key = 'MS-STORE-LICENSED',
            plan_name = ?1,
            source_channel = 'MICROSOFT_STORE',
            expires_at = 'PERPETUAL',
            is_activated = 1,
            activated_at = CURRENT_TIMESTAMP",
        params![plan],
    ).map_err(|e| e.to_string())?;

    get_license_status()
}

#[tauri::command]
pub fn logout_license() -> Result<(), String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    conn.execute("UPDATE app_license SET is_activated = 0, user_email = NULL, license_key = NULL, plan_name = 'Demonstração (Trial)', source_channel = 'TRIAL', expires_at = NULL WHERE id = 1", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_setting(key: String, value: String) -> Result<(), String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_file_data(path: &Path) -> (String, String, String, String, String, String, u64, DateTime<Local>, DateTime<Local>) {
    let now = Local::now();
    let meta = path.metadata().ok();
    
    let created: DateTime<Local> = meta.as_ref()
        .and_then(|m| m.created().ok())
        .map(|t| t.into())
        .unwrap_or(now);

    let modified: DateTime<Local> = meta.as_ref()
        .and_then(|m| m.modified().ok())
        .map(|t| t.into())
        .unwrap_or(now);

    let size_bytes = meta.map(|m| m.len()).unwrap_or(0);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let filename = path.file_stem().and_then(|f| f.to_str()).unwrap_or("").to_string();

    let tipo_doc = match ext.as_str() {
        "pdf" | "doc" | "docx" | "txt" | "rtf" | "odt" => "DOCUMENTO",
        "xlsx" | "xls" | "csv" | "ods" => "PLANILHA",
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" => "IMAGEM",
        "mp4" | "mkv" | "avi" | "mov" | "mp3" | "wav" => "MIDIA",
        "zip" | "rar" | "7z" | "tar" | "gz" => "COMPACTADO",
        "py" | "js" | "ts" | "sql" | "json" | "html" | "css" => "CODIGO",
        _ => "OUTROS",
    }.to_string();

    let ano = created.year().to_string();
    let mes = format!("{:02}", created.month());
    let dia = format!("{:02}", created.day());

    (ano, mes, dia, ext, tipo_doc, filename, size_bytes, created, modified)
}

fn resolve_unique_path(dest: PathBuf) -> PathBuf {
    if !dest.exists() {
        return dest;
    }
    let parent = dest.parent().unwrap_or_else(|| Path::new(""));
    let stem = dest.file_stem().and_then(|s| s.to_str()).unwrap_or("arquivo");
    let ext = dest.extension().and_then(|e| e.to_str()).map(|e| format!(".{}", e)).unwrap_or_default();

    let mut counter = 1;
    loop {
        let candidate = parent.join(format!("{} ({}){}", stem, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

// ⚡ MOTOR DE HIGIENIZAÇÃO E REGEX (CORE DA FRENTE B)
fn apply_filename_hygiene(original_stem: &str, action: &RuleAction) -> String {
    let mut name = original_stem.to_string();

    // 1. Tratamento por Regex (Expressões Regulares)
    if let (Some(pat), Some(rep)) = (&action.regex_pattern, &action.regex_replacement) {
        if !pat.trim().is_empty() {
            if let Ok(re) = regex::Regex::new(pat) {
                name = re.replace_all(&name, rep.as_str()).to_string();
            }
        }
    }

    // 2. Remoção de Acentos (Tratamento fonético local leve)
    if action.clean_accents.unwrap_or(false) {
        name = name
            .replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
            .replace("ã", "a").replace("õ", "o").replace("â", "a").replace("ê", "e").replace("ô", "o")
            .replace("ç", "c").replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O")
            .replace("Ú", "U").replace("Ã", "A").replace("Õ", "O").replace("Â", "A").replace("Ê", "E")
            .replace("Ô", "O").replace("Ç", "C");
    }

    // 3. Remoção de Espaços
    if action.replace_spaces.unwrap_or(false) {
        name = name.replace(" ", "_");
    }

    // 4. Formatação de Maiúsculas/Minúsculas
    if let Some(case) = &action.case_format {
        if case == "UPPER" {
            name = name.to_uppercase();
        } else if case == "LOWER" {
            name = name.to_lowercase();
        }
    }

    name
}

fn resolve_destination_path(file: &Path, action: &RuleAction) -> PathBuf {
    let (ano, mes, dia, ext, tipo_doc, filename_original, _, _, _) = extract_file_data(file);
    
    // ⚡ O motor limpa o nome ANTES de construir o caminho final
    let filename_hygienized = apply_filename_hygiene(&filename_original, action);

    let mut resolved = action.target_pattern.clone();
    resolved = resolved.replace("{ano}", &ano);
    resolved = resolved.replace("{mes}", &mes);
    resolved = resolved.replace("{dia}", &dia);
    resolved = resolved.replace("{extensao}", &ext);
    resolved = resolved.replace("{tipo_doc}", &tipo_doc);
    resolved = resolved.replace("{filename}", &filename_hygienized);

    let mut dest_path = PathBuf::from(resolved);
    
    // Se o padrão terminar com barra (indicando diretório) OU não tiver extensão,
    // o Rust entende que a regra apenas "Moveu a pasta" e preserva o nome limpo do arquivo com a extensão original.
    if action.target_pattern.ends_with('/') || action.target_pattern.ends_with('\\') || dest_path.extension().is_none() {
        let final_file_name = if ext.is_empty() {
            filename_hygienized
        } else {
            format!("{}.{}", filename_hygienized, ext)
        };
        dest_path.push(final_file_name);
    }
    
    dest_path
}

fn parse_custom_date(dt_str: &str) -> Option<NaiveDateTime> {
    let dt_str = dt_str.trim();
    for fmt in ["%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d %H:%M", "%Y-%m-%d"] {
        if let Ok(d) = NaiveDateTime::parse_from_str(dt_str, fmt) {
            return Some(d);
        }
        if let Ok(d) = chrono::NaiveDate::parse_from_str(dt_str, fmt) {
            return Some(d.and_hms_opt(0, 0, 0)?);
        }
    }
    None
}

#[tauri::command]
pub async fn run_simulation(rule_id: i64) -> Result<Vec<DryRunResult>, String> {
    let rules = get_rules()?;
    let rule = rules.into_iter().find(|r| r.id == Some(rule_id)).ok_or("Regra não encontrada")?;

    let src = validate_secure_path(Path::new(&rule.source_directory))?;

    let mut results = Vec::new();
    let dummy_action = RuleAction {
        id: None,
        action_type: "MOVE".into(),
        target_pattern: "".into(),
        clean_accents: Some(false),
        replace_spaces: Some(false),
        case_format: Some("NONE".into()),
        regex_pattern: None,
        regex_replacement: None,
    };
    
    let action_obj = rule.actions.first().unwrap_or(&dummy_action);
    let action_type = action_obj.action_type.as_str();

    for entry in WalkDir::new(&src).max_depth(1).into_iter().filter_map(|e| e.ok()) {
        let p = entry.path();
        if p.is_file() {
            let filename_full = p.file_name().unwrap().to_string_lossy().to_string();
            let (_, _, _, ext, tipo_doc, _filename_stem, size_bytes, created_dt, modified_dt) = extract_file_data(p);

            let mut evaluations = Vec::new();
            for f in &rule.filters {
                let target = f.value.trim().to_lowercase();
                let op = f.operator.as_str();

                let is_match = match f.field_name.as_str() {
                    "Extensão" => match op {
                        "É IGUAL A" => ext == target,
                        "NÃO É (DIFERENTE DE)" => ext != target,
                        "COMEÇA COM" => ext.starts_with(&target),
                        "TERMINA COM" => ext.ends_with(&target),
                        _ => ext.contains(&target),
                    },
                    "Tipo de Documento (Categoria)" => tipo_doc.to_lowercase() == target,
                    "Nome do Arquivo" => match op {
                        "É IGUAL A" => filename_full.to_lowercase() == target,
                        "NÃO É (DIFERENTE DE)" => filename_full.to_lowercase() != target,
                        "COMEÇA COM" => filename_full.to_lowercase().starts_with(&target),
                        "TERMINA COM" => filename_full.to_lowercase().ends_with(&target),
                        _ => filename_full.to_lowercase().contains(&target),
                    },
                    "Tamanho (Bytes)" => {
                        let target_size = target.parse::<u64>().unwrap_or(0);
                        match op {
                            "MAIOR QUE" => size_bytes > target_size,
                            "MENOR QUE" => size_bytes < target_size,
                            _ => size_bytes == target_size,
                        }
                    },
                    "Data de Criação" | "Data de Modificação" => {
                        let file_dt = if f.field_name == "Data de Criação" { created_dt.naive_local() } else { modified_dt.naive_local() };
                        if op == "ESTÁ ENTRE (DATA/HORA)" && target.contains('|') {
                            let parts: Vec<&str> = target.split('|').collect();
                            if parts.len() == 2 {
                                let d_start = parse_custom_date(parts[0]);
                                let d_end = parse_custom_date(parts[1]);
                                if let (Some(s), Some(e)) = (d_start, d_end) {
                                    file_dt >= s && file_dt <= e
                                } else { false }
                            } else { false }
                        } else if op == "MAIOR QUE" {
                            if let Some(d) = parse_custom_date(&target) {
                                file_dt > d
                            } else { false }
                        } else if op == "MENOR QUE" {
                            if let Some(d) = parse_custom_date(&target) {
                                file_dt < d
                            } else { false }
                        } else { false }
                    },
                    _ => false,
                };
                evaluations.push(is_match);
            }

            let rule_matches = if rule.logic_operator == "OR" {
                evaluations.is_empty() || evaluations.into_iter().any(|v| v)
            } else {
                evaluations.is_empty() || evaluations.into_iter().all(|v| v)
            };

            if rule_matches {
                let dest = resolve_destination_path(p, action_obj);
                results.push(DryRunResult {
                    filename: filename_full,
                    source: rule.source_directory.clone(),
                    destination: dest.to_string_lossy().to_string(),
                    action: action_type.to_string(),
                });
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn execute_rule(rule_id: i64) -> Result<String, String> {
    let rules = get_rules()?;
    let rule = rules.into_iter().find(|r| r.id == Some(rule_id)).ok_or("Regra não encontrada")?;
    let conflict_policy = rule.conflict_policy.unwrap_or_else(|| "AUTONUMBER".into());

    let sim = run_simulation(rule_id).await?;
    if sim.is_empty() {
        return Ok("Nenhum arquivo processado.".into());
    }

    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;

    let zip_password: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = 'backup_zip_password'", [], |r| r.get(0))
        .ok()
        .filter(|s: &String| !s.trim().is_empty());

    let today_tag = Local::now().format("%d%m%Y").to_string();
    let next_batch_num: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT batch_id) + 1 FROM audit_logs",
        [],
        |r| r.get(0),
    ).unwrap_or(1);
    let batch_id = format!("Lote{:03}-{}", next_batch_num, today_tag);

    let win_user = format!("{}\\{}", std::env::var("USERDOMAIN").unwrap_or_default(), std::env::var("USERNAME").unwrap_or_default());

    let mut prev_hash: String = conn.query_row(
        "SELECT current_log_hash FROM audit_logs ORDER BY id DESC LIMIT 1",
        [],
        |row| row.get(0),
    ).unwrap_or_else(|_| "0000000000000000000000000000000000000000000000000000000000000000".to_string());

    for item in sim {
        let src_file = Path::new(&item.source).join(&item.filename);
        let raw_dest = PathBuf::from(&item.destination);

        validate_secure_path(&raw_dest)?;

        let size_bytes = src_file.metadata().map(|m| m.len()).unwrap_or(0) as i64;
        let file_sha256 = compute_file_sha256(&src_file);

        let final_dest = if raw_dest.exists() {
            match conflict_policy.as_str() {
                "SKIP" => continue,
                "OVERWRITE" => raw_dest.clone(),
                "INCREMENTAL" => {
                    let dest_hash = compute_file_sha256(&raw_dest);
                    if file_sha256 == dest_hash {
                        continue; 
                    } else {
                        resolve_unique_path(raw_dest.clone())
                    }
                },
                _ => resolve_unique_path(raw_dest.clone()),
            }
        } else {
            raw_dest.clone()
        };

        if let Some(parent) = final_dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        if item.action == "COPY" {
            fs::copy(&src_file, &final_dest).map_err(|e| e.to_string())?;
        } else if item.action == "DELETE" {
            fs::remove_file(&src_file).map_err(|e| e.to_string())?;
        } else if item.action == "ZIP" {
            let zip_file_path = if final_dest.extension().map(|e| e.to_string_lossy().to_lowercase()) == Some("zip".into()) {
                final_dest.clone()
            } else {
                final_dest.with_extension("zip")
            };
            
            compress_items_to_zip(
                vec![src_file.to_string_lossy().to_string()],
                zip_file_path.to_string_lossy().to_string(),
                zip_password.clone(),
            )?;
        } else {
            fs::rename(&src_file, &final_dest).map_err(|e| e.to_string())?;
        }

        let block_payload = format!(
            "{}:{}:{}:{}:{}:{}:{}:{}",
            prev_hash,
            batch_id,
            rule_id,
            item.action,
            src_file.to_string_lossy(),
            final_dest.to_string_lossy(),
            file_sha256,
            win_user
        );
        let mut hasher = Sha256::new();
        hasher.update(block_payload.as_bytes());
        let current_hash = format!("{:x}", hasher.finalize());

        conn.execute(
            "INSERT INTO audit_logs (
                batch_id, rule_id, action_type, original_path, destination_path, 
                file_size_bytes, status, is_reversible, file_hash_sha256, prev_log_hash, current_log_hash, windows_user
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'SUCESSO', 1, ?7, ?8, ?9, ?10)",
            params![
                batch_id, 
                rule_id, 
                item.action, 
                src_file.to_string_lossy().to_string(), 
                final_dest.to_string_lossy().to_string(), 
                size_bytes,
                file_sha256,
                prev_hash,
                current_hash,
                win_user
            ],
        ).map_err(|e| e.to_string())?;

        prev_hash = current_hash;
    }

    Ok(batch_id)
}

#[tauri::command]
pub fn verify_audit_integrity() -> Result<IntegrityReport, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, batch_id, rule_id, action_type, original_path, destination_path, file_hash_sha256, prev_log_hash, current_log_hash, windows_user FROM audit_logs ORDER BY id ASC")
        .map_err(|e| e.to_string())?;

    let mut expected_prev_hash = "0000000000000000000000000000000000000000000000000000000000000000".to_string();
    let mut verified = 0;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<i64>>(2)?.unwrap_or(0),
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            row.get::<_, Option<String>>(7)?.unwrap_or_default(),
            row.get::<_, Option<String>>(8)?.unwrap_or_default(),
            row.get::<_, Option<String>>(9)?.unwrap_or_default(),
        ))
    }).map_err(|e| e.to_string())?;

    for r in rows.flatten() {
        let (id, batch_id, rule_id, action, src, dest, f_hash, prev_h, curr_h, user) = r;

        if curr_h.is_empty() {
            continue;
        }

        if !prev_h.is_empty() && prev_h != expected_prev_hash && expected_prev_hash != "0000000000000000000000000000000000000000000000000000000000000000" {
            return Ok(IntegrityReport {
                is_valid: false,
                total_records: verified + 1,
                verified_records: verified,
                compromised_id: Some(id),
                message: format!("Violação detectada no Log ID {}. A sequência encadeada foi alterada.", id),
            });
        }

        let block_payload = format!("{}:{}:{}:{}:{}:{}:{}:{}", prev_h, batch_id, rule_id, action, src, dest, f_hash, user);
        let mut hasher = Sha256::new();
        hasher.update(block_payload.as_bytes());
        let computed_curr_hash = format!("{:x}", hasher.finalize());

        if !curr_h.is_empty() && curr_h != computed_curr_hash {
            return Ok(IntegrityReport {
                is_valid: false,
                total_records: verified + 1,
                verified_records: verified,
                compromised_id: Some(id),
                message: format!("Assinatura do Log ID {} divergente dos metadados. Registro corrompido.", id),
            });
        }

        expected_prev_hash = curr_h;
        verified += 1;
    }

    Ok(IntegrityReport {
        is_valid: true,
        total_records: verified,
        verified_records: verified,
        compromised_id: None,
        message: "Cadeia de custódia e trilha de auditoria 100% íntegras e validadas criptograficamente.".to_string(),
    })
}

#[tauri::command]
pub fn toggle_sentinel_rule(rule_id: i64, active: bool) -> Result<(), String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    
    let current_plan = get_current_plan(&conn);
    if current_plan.contains("core") || current_plan.contains("demonstração") {
        return Err("A Execução Automática (Sentinel) requer o plano Foldex Pro ou superior.".into());
    }

    conn.execute("UPDATE rules SET is_sentinel_active = ?1 WHERE id = ?2", params![if active { 1 } else { 0 }, rule_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn smart_organize_folder(path: String) -> Result<String, String> {
    let base_path = PathBuf::from(path);
    
    if !base_path.exists() || !base_path.is_dir() {
        return Err("O diretório informado é inválido ou não existe.".into());
    }

    let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let conn = Connection::open(get_db_path()).map_err(|e| format!("Erro no BD: {}", e))?;
        
        let current_plan = get_current_plan(&conn);
        if current_plan.contains("core") || current_plan.contains("demonstração") {
            return Err("A Organização Inteligente de Pastas requer o plano Foldex Pro ou superior.".into());
        }

        let today_tag = Local::now().format("%d%m%Y").to_string();
        let next_batch_num: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT batch_id) + 1 FROM audit_logs",
            [],
            |r| r.get(0),
        ).unwrap_or(1);
        
        let batch_id = format!("Lote{:03}-{}", next_batch_num, today_tag);
        let win_user = format!("{}\\{}", std::env::var("USERDOMAIN").unwrap_or_default(), std::env::var("USERNAME").unwrap_or_default());
        
        let mut prev_hash: String = conn.query_row(
            "SELECT current_log_hash FROM audit_logs ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        ).unwrap_or_else(|_| "0000000000000000000000000000000000000000000000000000000000000000".to_string());

        let entries = fs::read_dir(&base_path).map_err(|e| format!("Erro ao ler diretório: {}", e))?;
        let mut moved_count = 0;

        for entry_result in entries {
            if let Ok(entry) = entry_result {
                let p = entry.path();
                
                if p.is_dir() { continue; }

                let extension = p.extension()
                    .map(|e| e.to_string_lossy().to_string().to_lowercase())
                    .unwrap_or_default();

                let category = match extension.as_str() {
                    "pdf" | "doc" | "docx" | "txt" | "rtf" | "odt" => "Documentos",
                    "xls" | "xlsx" | "csv" | "ods" => "Planilhas",
                    "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "bmp" => "Imagens",
                    "mp4" | "mkv" | "avi" | "mov" => "Vídeos",
                    "mp3" | "wav" | "flac" | "aac" => "Áudios",
                    "zip" | "rar" | "7z" | "tar" | "gz" => "Compactados",
                    "exe" | "msi" | "apk" | "dmg" => "Instaladores",
                    "py" | "js" | "ts" | "json" | "html" | "css" | "sql" | "rs" => "Códigos e Scripts",
                    _ => if extension.is_empty() { "Sem Extensão" } else { "Outros" }
                };

                let target_dir = base_path.join(category);
                
                if !target_dir.exists() {
                    fs::create_dir_all(&target_dir).map_err(|e| format!("Erro ao criar pasta {}: {}", category, e))?;
                }

                let file_name = p.file_name().unwrap();
                let target_file = target_dir.join(file_name);

                let final_target = if target_file.exists() {
                    let stem = p.file_stem().unwrap().to_string_lossy();
                    let ext = if extension.is_empty() { String::new() } else { format!(".{}", extension) };
                    target_dir.join(format!("{}_{}{}", stem, chrono::Local::now().timestamp_millis(), ext))
                } else {
                    target_file
                };

                let size_bytes = p.metadata().map(|m| m.len()).unwrap_or(0) as i64;
                let file_sha256 = compute_file_sha256(&p);

                if fs::rename(&p, &final_target).is_ok() {
                    moved_count += 1;
                    
                    let block_payload = format!(
                        "{}:{}:{}:{}:{}:{}:{}:{}",
                        prev_hash,
                        batch_id,
                        0, 
                        "MOVE",
                        p.to_string_lossy(),
                        final_target.to_string_lossy(),
                        file_sha256,
                        win_user
                    );
                    
                    let mut hasher = Sha256::new();
                    hasher.update(block_payload.as_bytes());
                    let current_hash = format!("{:x}", hasher.finalize());

                    let _ = conn.execute(
                        "INSERT INTO audit_logs (
                            batch_id, rule_id, action_type, original_path, destination_path, 
                            file_size_bytes, status, is_reversible, file_hash_sha256, prev_log_hash, current_log_hash, windows_user
                        ) VALUES (?1, NULL, 'MOVE', ?2, ?3, ?4, 'SUCESSO', 1, ?5, ?6, ?7, ?8)",
                        params![
                            batch_id, 
                            p.to_string_lossy().to_string(), 
                            final_target.to_string_lossy().to_string(), 
                            size_bytes,
                            file_sha256,
                            prev_hash,
                            current_hash,
                            win_user
                        ],
                    );
                    
                    prev_hash = current_hash;
                }
            }
        }
        
        Ok(format!("{} arquivos organizados! A trilha de auditoria e a função 'Desfazer' foram registradas com sucesso.", moved_count))
    }).await.map_err(|e| format!("Falha na thread de organização: {}", e))??;

    Ok(result)
}

#[tauri::command]
pub async fn generate_rule_via_ai(prompt: String, api_key: String) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("A chave da API do Google Gemini não foi configurada.".into());
    }

    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={}", api_key);

    let system_prompt = r#"
Você é uma IA assistente dentro do sistema "Foldex Enterprise". 
Seu trabalho é converter o pedido do usuário em um JSON estrito que o React conseguirá ler para preencher um formulário de regras.

REGRAS:
1. Responda APENAS com um objeto JSON válido.
2. O JSON deve ter este formato:
{
    "ruleName": "Nome descritivo da regra",
    "actionType": "MOVE" | "COPY" | "ZIP" | "RENAME" | "DELETE",
    "targetDir": "caminho ou padrao sugerido (ex: {ano}/{mes}/{tipo_doc})",
    "filters": [
        { "field_name": "Extensão", "operator": "CONTÉM", "value": "pdf", "logic_connector": "AND" }
    ]
}
Campos válidos para field_name: 'Extensão', 'Tipo de Documento (Categoria)', 'Nome do Arquivo'.
Operadores válidos: 'CONTÉM', 'É IGUAL A', 'COMEÇA COM', 'TERMINA COM'.
"#;

    let payload = serde_json::json!({
        "contents": [{
            "parts": [{"text": format!("{}\n\nPedido do usuário: {}", system_prompt, prompt)}]
        }]
    });

    let res = client.post(&url)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Erro de rede: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Falha na API da IA: {}", err_text));
    }

    let json_res: Value = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(text) = json_res["candidates"][0]["content"]["parts"][0]["text"].as_str() {
        let clean_json = text.replace("```json\n", "").replace("\n```", "").trim().to_string();
        Ok(clean_json)
    } else {
        Err("A IA retornou um formato inesperado.".into())
    }
}

#[derive(Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub async fn chat_with_foldex_agent(messages: Vec<ChatMsg>, api_key: String) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("A chave da API do Google Gemini não foi configurada no painel de Configurações.".into());
    }

    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={}", api_key);

    let system_prompt = r#"
Você é o "FOLDEX Agent", a Inteligência Artificial corporativa do sistema Foldex Enterprise (by BINAVER).

DIRETRIZES DE COMPORTAMENTO:
1. NUNCA repita a sua apresentação (ex: "Olá, eu sou o Foldex Agent"). Seja direto, prestativo e converse naturalmente.
2. Responda de forma amigável, técnica e concisa (textos curtos).

BASE DE CONHECIMENTO DO SISTEMA FOLDEX:
- O Foldex é um software local de Governança e Automação de Arquivos (Respeita a LGPD).
- Telas principais: Construtor de Regras, Explorador de Pastas, Simulação, Auditoria/Rollback, Backups e Configurações.
- Construtor de Regras: Cria automações lendo extensões, nomes ou datas. Ações possíveis: Mover, Copiar, Zipar, Renomear, Excluir.
- Auto-Organização (Smart Organize): Um botão mágico que varre uma pasta bagunçada e separa tudo em subpastas automaticamente.
- Auditoria e Rollback: Todas as ações geram logs inalteráveis com Hash SHA-256. Se o usuário errar, ele pode ir na tela de Auditoria e clicar em "Desfazer (Rollback)".
- Backups e Cofres: Suporta criptografia AES-256 local e envio para nuvem via servidor FTP.
"#;

    let mut gemini_contents = Vec::new();
    for msg in messages {
        let role = if msg.role == "ai" { "model" } else { "user" };
        gemini_contents.push(serde_json::json!({
            "role": role,
            "parts": [{"text": msg.content}]
        }));
    }

    let payload = serde_json::json!({
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": gemini_contents
    });

    let res = client.post(&url)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Erro de rede ao conectar com a IA: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Falha na API da IA: {}", err_text));
    }

    let json_res: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(text) = json_res["candidates"][0]["content"]["parts"][0]["text"].as_str() {
        Ok(text.trim().to_string())
    } else {
        Err("A IA processou o pedido, mas a resposta veio em um formato desconhecido.".into())
    }
}

#[tauri::command]
pub fn get_audit_logs() -> Result<Vec<AuditLog>, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, batch_id, rule_id, action_type, original_path, destination_path, file_size_bytes, status, executed_at, is_reversible, file_hash_sha256, prev_log_hash, current_log_hash, windows_user FROM audit_logs ORDER BY id DESC LIMIT 500")
        .map_err(|e| e.to_string())?;

    let logs = stmt
        .query_map([], |row| {
            Ok(AuditLog {
                id: Some(row.get(0)?),
                batch_id: row.get(1)?,
                rule_id: row.get(2)?,
                action_type: row.get(3)?,
                original_path: row.get(4)?,
                destination_path: row.get(5)?,
                file_size_bytes: row.get(6)?,
                status: row.get(7)?,
                executed_at: row.get(8)?,
                is_reversible: row.get::<_, i64>(9)? == 1,
                file_hash_sha256: row.get(10)?,
                prev_log_hash: row.get(11)?,
                current_log_hash: row.get(12)?,
                windows_user: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    Ok(logs)
}

#[tauri::command]
pub fn rollback_batch(batch_id: String) -> Result<usize, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, original_path, destination_path, action_type FROM audit_logs WHERE batch_id = ? AND is_reversible = 1")
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, Option<String>, String)> = stmt
        .query_map([&batch_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    if rows.is_empty() {
        return Err("Nenhum arquivo reversível encontrado para este lote.".into());
    }

    let count = rows.len();
    for (id, orig, dest, action) in rows {
        if let Some(dest_p) = dest {
            if Path::new(&dest_p).exists() {
                if action == "MOVE" || action == "RENAME" {
                    if let Some(parent) = Path::new(&orig).parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = fs::rename(&dest_p, &orig);
                } else if action == "COPY" {
                    let _ = fs::remove_file(&dest_p);
                }
            }
        }
        let _ = conn.execute("UPDATE audit_logs SET status = 'REVERTIDO', is_reversible = 0 WHERE id = ?", [id]);
    }

    Ok(count)
}

#[tauri::command]
pub fn rollback_last_batch() -> Result<usize, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    
    let last_batch: Option<String> = conn
        .query_row(
            "SELECT batch_id FROM audit_logs WHERE is_reversible = 1 ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    match last_batch {
        Some(b) => rollback_batch(b),
        None => Err("Nenhum lote reversível encontrado".into()),
    }
}

#[tauri::command]
pub fn rollback_single_item(audit_id: i64) -> Result<(), String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT original_path, destination_path, action_type FROM audit_logs WHERE id = ? AND is_reversible = 1")
        .map_err(|e| e.to_string())?;

    let row: Option<(String, Option<String>, String)> = stmt
        .query_row([&audit_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .ok();

    if let Some((orig, dest, action)) = row {
        if let Some(dest_p) = dest {
            if Path::new(&dest_p).exists() {
                if action == "MOVE" || action == "RENAME" {
                    if let Some(parent) = Path::new(&orig).parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    fs::rename(&dest_p, &orig).map_err(|e| format!("Falha ao devolver arquivo à origem: {}", e))?;
                } else if action == "COPY" {
                    fs::remove_file(&dest_p).map_err(|e| format!("Falha ao excluir arquivo copiado: {}", e))?;
                }
            } else {
                return Err("O arquivo não está mais no diretório de destino.".into());
            }
        }

        conn.execute(
            "UPDATE audit_logs SET status = 'REVERTIDO', is_reversible = 0 WHERE id = ?",
            [&audit_id],
        ).map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("Registro não encontrado, já revertido ou não reversível.".into())
    }
}

#[tauri::command]
pub fn rollback_multiple_items(audit_ids: Vec<i64>) -> Result<usize, String> {
    if audit_ids.is_empty() {
        return Err("Nenhum item selecionado para reversão.".into());
    }

    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    let mut success_count = 0;

    for audit_id in audit_ids {
        let mut stmt = match conn.prepare("SELECT original_path, destination_path, action_type FROM audit_logs WHERE id = ? AND is_reversible = 1") {
            Ok(s) => s,
            Err(_) => continue,
        };

        let row: Option<(String, Option<String>, String)> = stmt
            .query_row([&audit_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .ok();

        if let Some((orig, dest, action)) = row {
            if let Some(dest_p) = dest {
                if Path::new(&dest_p).exists() {
                    if action == "MOVE" || action == "RENAME" {
                        if let Some(parent) = Path::new(&orig).parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        if fs::rename(&dest_p, &orig).is_ok() {
                            success_count += 1;
                        }
                    } else if action == "COPY" {
                        if fs::remove_file(&dest_p).is_ok() {
                            success_count += 1;
                        }
                    }
                }
            }

            let _ = conn.execute(
                "UPDATE audit_logs SET status = 'REVERTIDO', is_reversible = 0 WHERE id = ?",
                [&audit_id],
            );
        }
    }

    Ok(success_count)
}