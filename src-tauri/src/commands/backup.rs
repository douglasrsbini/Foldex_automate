use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result as SqlResult};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use suppaftp::FtpStream;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter, AesMode};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupTask {
    pub id: Option<i32>,
    pub task_name: String,
    pub source_type: String,
    pub connection_string: Option<String>,
    pub source_path: Option<String>,
    pub destination_dir: String,
    pub encrypt: bool,
    pub password: Option<String>,
    pub upload_offsite: Option<bool>,
    pub ftp_host: Option<String>,
    pub ftp_user: Option<String>,
    pub ftp_pass: Option<String>,
    pub is_scheduled: Option<bool>,
    pub cron_schedule: Option<String>,
    pub schedule_type: Option<String>,
    pub schedule_day: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BackupResult {
    pub success: bool,
    pub message: String,
    pub file_path: String,
    pub size_bytes: u64,
}

// ⚡ NOVA ESTRUTURA PARA OS LOGS DE AUDITORIA
#[derive(Debug, Serialize)]
pub struct BackupLog {
    pub id: i32,
    pub task_name: String,
    pub status: String, // "SUCCESS" ou "ERROR"
    pub message: String,
    pub created_at: String,
}

fn get_db_connection() -> SqlResult<Connection> {
    let conn = Connection::open("foldex.db")?;
    
    // Tabela de Tarefas
    conn.execute(
        "CREATE TABLE IF NOT EXISTS backup_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            connection_string TEXT,
            source_path TEXT,
            destination_dir TEXT NOT NULL,
            encrypt INTEGER NOT NULL,
            password TEXT,
            upload_offsite INTEGER NOT NULL,
            ftp_host TEXT,
            ftp_user TEXT,
            ftp_pass TEXT,
            is_scheduled INTEGER NOT NULL,
            cron_schedule TEXT,
            schedule_type TEXT,
            schedule_day TEXT
        )",
        [],
    )?;

    // ⚡ NOVA TABELA DE LOGS (Criada automaticamente)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS backup_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    Ok(conn)
}

// Função auxiliar para inserir logs no banco
pub fn insert_backup_log(task_name: &str, status: &str, message: &str) {
    if let Ok(conn) = get_db_connection() {
        // Usa o localtime para salvar o horário exato do Windows do cliente
        let _ = conn.execute(
            "INSERT INTO backup_logs (task_name, status, message, created_at) VALUES (?1, ?2, ?3, datetime('now', 'localtime'))",
            params![task_name, status, message],
        );
    }
}

// ⚡ NOVO COMANDO: BUSCAR OS LOGS PARA A TELA
#[tauri::command]
pub fn get_backup_logs() -> Result<Vec<BackupLog>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    // Traz os últimos 100 logs ordenados do mais recente para o mais antigo
    let mut stmt = conn.prepare("SELECT id, task_name, status, message, created_at FROM backup_logs ORDER BY id DESC LIMIT 100").map_err(|e| e.to_string())?;
    
    let log_iter = stmt.query_map([], |row| {
        Ok(BackupLog {
            id: row.get(0)?,
            task_name: row.get(1)?,
            status: row.get(2)?,
            message: row.get(3)?,
            created_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for l in log_iter {
        if let Ok(log) = l { logs.push(log); }
    }
    Ok(logs)
}

#[tauri::command]
pub fn get_backup_tasks() -> Result<Vec<BackupTask>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, task_name, source_type, connection_string, source_path, destination_dir, encrypt, password, upload_offsite, ftp_host, ftp_user, ftp_pass, is_scheduled, cron_schedule, schedule_type, schedule_day FROM backup_tasks").map_err(|e| e.to_string())?;
    
    let task_iter = stmt.query_map([], |row| {
        Ok(BackupTask {
            id: row.get(0)?,
            task_name: row.get(1)?,
            source_type: row.get(2)?,
            connection_string: row.get(3)?,
            source_path: row.get(4)?,
            destination_dir: row.get(5)?,
            encrypt: row.get::<_, i32>(6)? == 1,
            password: row.get(7)?,
            upload_offsite: Some(row.get::<_, i32>(8)? == 1),
            ftp_host: row.get(9)?,
            ftp_user: row.get(10)?,
            ftp_pass: row.get(11)?,
            is_scheduled: Some(row.get::<_, i32>(12)? == 1),
            cron_schedule: row.get(13)?,
            schedule_type: row.get(14)?,
            schedule_day: row.get(15)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for t in task_iter { tasks.push(t.map_err(|e| e.to_string())?); }
    Ok(tasks)
}

#[tauri::command]
pub fn save_backup_task(task: BackupTask) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let encrypt_int = if task.encrypt { 1 } else { 0 };
    let upload_int = if task.upload_offsite.unwrap_or(false) { 1 } else { 0 };
    let scheduled_int = if task.is_scheduled.unwrap_or(false) { 1 } else { 0 };

    if let Some(id) = task.id {
        conn.execute(
            "UPDATE backup_tasks SET task_name = ?1, source_type = ?2, connection_string = ?3, source_path = ?4, destination_dir = ?5, encrypt = ?6, password = ?7, upload_offsite = ?8, ftp_host = ?9, ftp_user = ?10, ftp_pass = ?11, is_scheduled = ?12, cron_schedule = ?13, schedule_type = ?14, schedule_day = ?15 WHERE id = ?16",
            params![task.task_name, task.source_type, task.connection_string, task.source_path, task.destination_dir, encrypt_int, task.password, upload_int, task.ftp_host, task.ftp_user, task.ftp_pass, scheduled_int, task.cron_schedule, task.schedule_type, task.schedule_day, id],
        ).map_err(|e| e.to_string())?;
        Ok("Rotina atualizada com sucesso".to_string())
    } else {
        conn.execute(
            "INSERT INTO backup_tasks (task_name, source_type, connection_string, source_path, destination_dir, encrypt, password, upload_offsite, ftp_host, ftp_user, ftp_pass, is_scheduled, cron_schedule, schedule_type, schedule_day) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![task.task_name, task.source_type, task.connection_string, task.source_path, task.destination_dir, encrypt_int, task.password, upload_int, task.ftp_host, task.ftp_user, task.ftp_pass, scheduled_int, task.cron_schedule, task.schedule_type, task.schedule_day],
        ).map_err(|e| e.to_string())?;
        Ok("Rotina criada com sucesso".to_string())
    }
}

#[tauri::command]
pub fn delete_backup_task(id: i32) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM backup_tasks WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok("Rotina removida com sucesso".to_string())
}

// O MOTOR REAL (Privado) - Todo o trabalho sujo é feito aqui
async fn internal_execute_backup(task: BackupTask) -> Result<BackupResult, String> {
    let safe_task_name = task.task_name.replace(&['\\', '/', ':', '*', '?', '"', '<', '>', '|'][..], "_");
    let final_zip_path = format!("{}/{}.zip", task.destination_dir, safe_task_name); 
    
    if task.source_type == "FILES" {
        let source_path = task.source_path.clone().ok_or("Caminho de origem não informado")?;
        let src_dir = Path::new(&source_path);

        if !src_dir.exists() { return Err("A pasta de origem não existe.".to_string()); }

        let file = File::create(&final_zip_path).map_err(|e| format!("Erro ao criar arquivo ZIP: {}", e))?;
        let mut zip = ZipWriter::new(file);
        let mut options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated).unix_permissions(0o755);

        if task.encrypt {
            if let Some(ref pass) = task.password {
                options = options.with_aes_encryption(AesMode::Aes256, pass);
            }
        }

        let walkdir = WalkDir::new(src_dir);
        for entry in walkdir.into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            let name = path.strip_prefix(src_dir).unwrap();
            if name.as_os_str().is_empty() { continue; }

            #[allow(deprecated)]
            let name_str = name.to_string_lossy().into_owned().replace("\\", "/");

            if path.is_file() {
                zip.start_file(name_str, options.clone()).map_err(|e| format!("Erro ao iniciar arquivo: {}", e))?;
                let mut f = File::open(path).map_err(|e| format!("Erro ao abrir leitura: {}", e))?;
                let mut buffer = Vec::new();
                f.read_to_end(&mut buffer).map_err(|e| format!("Erro lendo arquivo: {}", e))?;
                zip.write_all(&buffer).map_err(|e| format!("Erro escrevendo zip: {}", e))?;
            } else if path.is_dir() {
                zip.add_directory(name_str, options.clone()).map_err(|e| format!("Erro criando diretório: {}", e))?;
            }
        }
        zip.finish().map_err(|e| format!("Falha ao fechar cofre: {}", e))?;
    } else {
        return Err("Módulo de banco de dados SQL pendente de implementação.".to_string());
    }

    let mut message = format!("Backup '{}' gerado com sucesso.", task.task_name);

    if task.upload_offsite.unwrap_or(false) {
        let host = task.ftp_host.clone().ok_or("Host FTP não informado")?;
        let user = task.ftp_user.clone().unwrap_or_default();
        let pass = task.ftp_pass.clone().unwrap_or_default();
        let file_name = Path::new(&final_zip_path).file_name().and_then(|n| n.to_str()).unwrap_or("backup.zip").to_string(); 
        let zip_path_clone = final_zip_path.clone();

        let upload_result = tokio::task::spawn_blocking(move || -> Result<(), String> {
            let mut ftp_stream = FtpStream::connect(format!("{}:21", host)).map_err(|e| e.to_string())?;
            ftp_stream.login(&user, &pass).map_err(|e| e.to_string())?;
            ftp_stream.transfer_type(suppaftp::types::FileType::Binary).map_err(|e| e.to_string())?;
            let mut file_reader = fs::File::open(&zip_path_clone).map_err(|e| e.to_string())?;
            ftp_stream.put_file(&file_name, &mut file_reader).map_err(|e| e.to_string())?;
            let _ = ftp_stream.quit();
            Ok(())
        }).await.map_err(|e| e.to_string())?;

        match upload_result {
            Ok(_) => message = "Cofre e Nuvem FTP concluídos!".to_string(),
            Err(e) => return Err(format!("Salvo local, erro na Nuvem: {}", e)),
        }
    }

    let meta = fs::metadata(&final_zip_path).map_err(|e| e.to_string())?;

    Ok(BackupResult {
        success: true,
        message,
        file_path: final_zip_path,
        size_bytes: meta.len(),
    })
}

// ⚡ O WRAPPER INTELIGENTE: Pega o resultado e injeta no Log de forma invisível
#[tauri::command]
pub async fn execute_advanced_backup(task: BackupTask) -> Result<BackupResult, String> {
    let task_name_clone = task.task_name.clone(); // Clonamos o nome para usar nos logs em caso de erro

    // Vamos envolver a execução numa função interna para capturar qualquer erro facilmente
    let result = async {
        let final_zip_path = format!("{}/{}.zip", task.destination_dir, task.task_name); 
        let path_obj = Path::new(&final_zip_path);

        if task.source_type == "FILES" {
            let source_dir = task.source_path.clone().ok_or("Caminho de origem não informado para o backup de arquivos.")?;
            let src_path = Path::new(&source_dir);
            
            if !src_path.exists() {
                return Err("Diretório de origem não encontrado.".to_string());
            }

            let file = File::create(path_obj).map_err(|e| format!("Erro ao criar arquivo ZIP: {}", e))?;
            let mut zip = zip::write::ZipWriter::new(file);

            let mut options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(0o755);

            if task.encrypt {
                if let Some(ref pass) = task.password {
                    if !pass.trim().is_empty() {
                        options = options.with_aes_encryption(zip::AesMode::Aes256, pass);
                    }
                }
            }

            let mut buffer = Vec::new();

            for entry in walkdir::WalkDir::new(src_path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                let name = path.strip_prefix(src_path).unwrap().to_string_lossy();
                
                if path.is_file() {
                    zip.start_file(name.into_owned(), options.clone()).map_err(|e| e.to_string())?;
                    let mut f = File::open(path).map_err(|e| e.to_string())?;
                    std::io::Read::read_to_end(&mut f, &mut buffer).map_err(|e| e.to_string())?;
                    std::io::Write::write_all(&mut zip, &buffer).map_err(|e| e.to_string())?;
                    buffer.clear();
                } else if !name.is_empty() {
                    zip.add_directory(name.into_owned(), options.clone()).map_err(|e| e.to_string())?;
                }
            }
            zip.finish().map_err(|e| format!("Erro ao finalizar arquivo ZIP: {}", e))?;
            
        } else {
            File::create(path_obj).map_err(|e| format!("Erro ao criar o cofre local: {}", e))?;
        }

        let mut message = format!("Backup '{}' gerado com sucesso.", task.task_name);

        if task.upload_offsite.unwrap_or(false) {
            let host = task.ftp_host.clone().ok_or("Host FTP não informado")?;
            let user = task.ftp_user.clone().unwrap_or_default();
            let pass = task.ftp_pass.clone().unwrap_or_default();

            let file_name = path_obj
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("backup.zip")
                .to_string(); 

            let zip_path_clone = final_zip_path.clone();

            let upload_result = tokio::task::spawn_blocking(move || -> Result<(), String> {
                let mut ftp_stream = suppaftp::FtpStream::connect(format!("{}:21", host))
                    .map_err(|e| format!("Erro ao conectar no Servidor FTP: {}", e))?;
                
                ftp_stream.login(&user, &pass)
                    .map_err(|e| format!("Usuário ou senha do FTP incorretos: {}", e))?;
                
                ftp_stream.transfer_type(suppaftp::types::FileType::Binary)
                    .map_err(|e| format!("Erro de protocolo binário: {}", e))?;

                let mut file_reader = File::open(&zip_path_clone)
                    .map_err(|e| format!("Erro ao ler o ZIP para envio: {}", e))?;
                
                ftp_stream.put_file(&file_name, &mut file_reader)
                    .map_err(|e| format!("Falha durante a transferência do arquivo: {}", e))?;
                    
                let _ = ftp_stream.quit();

                Ok(())
            }).await.map_err(|e| format!("Falha crítica na thread: {}", e))?;

            match upload_result {
                Ok(_) => {
                    message = "Cofre local e Upload Remoto concluídos!".to_string();
                },
                Err(e) => {
                    return Err(format!("Backup salvo local, mas falhou a Nuvem: {}", e));
                }
            }
        }

        let meta = fs::metadata(&final_zip_path).map_err(|e| e.to_string())?;

        Ok(BackupResult {
            success: true,
            message,
            file_path: final_zip_path,
            size_bytes: meta.len(),
        })
    }.await;

    // ⚡ A MÁGICA ACONTECE AQUI: Registramos o log no banco independente de ter dado certo ou errado
    match result {
        Ok(backup_res) => {
            insert_backup_log(&task_name_clone, "SUCCESS", &backup_res.message);
            Ok(backup_res)
        },
        Err(e) => {
            insert_backup_log(&task_name_clone, "ERROR", &e);
            Err(e)
        }
    }
}