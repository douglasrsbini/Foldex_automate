use rusqlite::Connection;
use chrono::{Local, Datelike, Timelike};
use std::collections::HashMap;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

// Importa o comando e as estruturas que você já fez no backup.rs
use crate::commands::backup::{execute_advanced_backup, BackupTask};

// Função para abrir o banco de dados local
fn get_db_connection() -> Result<Connection, rusqlite::Error> {
    Connection::open("foldex.db")
}

// Interpretador leve e customizado de Cron
fn should_run(cron: &str, now: &chrono::DateTime<chrono::Local>) -> bool {
    let parts: Vec<&str> = cron.split_whitespace().collect();
    if parts.len() < 5 { return false; }
    
    let c_min = parts[0];
    let c_hour = parts[1];
    let c_dom = parts[2];
    let _c_mon = parts[3]; // Genérico (*) para os meses
    let c_dow = parts[4];
    
    // Validação de Minuto
    if c_min != "*" && c_min.parse::<u32>().unwrap_or(99) != now.minute() { return false; }
    
    // Validação de Hora
    if c_hour != "*" && c_hour.parse::<u32>().unwrap_or(99) != now.hour() { return false; }
    
    // Validação do Dia do Mês (Tratamento especial para o 'L' = Último dia)
    if c_dom != "*" {
        if c_dom == "L" {
            // Descobre se amanhã começa um novo mês. Se sim, hoje é o último dia.
            let next_day = now.naive_local().date() + chrono::Duration::days(1);
            if next_day.month() == now.month() { return false; }
        } else {
            if c_dom.parse::<u32>().unwrap_or(99) != now.day() { return false; }
        }
    }
    
    // Validação do Dia da Semana (0 = Domingo, 6 = Sábado)
    if c_dow != "*" {
        let dow_num = now.weekday().number_from_sunday() % 7; 
        if c_dow.parse::<u32>().unwrap_or(99) != dow_num { return false; }
    }
    
    true
}

pub async fn start_background_watcher(app: AppHandle) {
    println!("🚀 Foldex Orchestrator: Motor de agendamentos em background iniciado.");
    
    // Mapeamento para evitar que a mesma rotina rode duas vezes no mesmo minuto
    let mut last_run: HashMap<i32, chrono::DateTime<chrono::Local>> = HashMap::new();

    loop {
        // O orquestrador respira a cada 30 segundos
        tokio::time::sleep(Duration::from_secs(30)).await;
        
        let now = Local::now();

        let conn = match get_db_connection() {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Busca apenas as rotinas ativas (is_scheduled = 1)
        let mut stmt = match conn.prepare("SELECT id, task_name, source_type, connection_string, source_path, destination_dir, encrypt, password, upload_offsite, ftp_host, ftp_user, ftp_pass, is_scheduled, cron_schedule FROM backup_tasks WHERE is_scheduled = 1") {
            Ok(s) => s,
            Err(_) => continue,
        };

        let task_iter = match stmt.query_map([], |row| {
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
                is_scheduled: Some(true),
                cron_schedule: row.get(13)?,
                // ⚡ CORREÇÃO: Adicionado os dois campos faltantes para o compilador não reclamar
                schedule_type: None,
                schedule_day: None,
            })
        }) {
            Ok(iter) => iter,
            Err(_) => continue,
        };

        for task_result in task_iter {
            if let Ok(task) = task_result {
                if let Some(cron) = &task.cron_schedule {
                    if should_run(cron, &now) {
                        let task_id = task.id.unwrap_or(0);
                        
                        // Trava de segurança: Se a rotina rodou há menos de 2 minutos, ignora.
                        if let Some(last) = last_run.get(&task_id) {
                            if now.signed_duration_since(*last).num_minutes() < 2 {
                                continue;
                            }
                        }

                        println!("⏳ Orquestrador acionou a rotina: {}", task.task_name);
                        last_run.insert(task_id, now);
                        
                        let task_name_clone = task.task_name.clone();
                        let app_clone = app.clone();

                        // Dispara a rotina em uma thread separada para não pausar o Watcher
                        tokio::spawn(async move {
                            match execute_advanced_backup(task).await {
                                Ok(res) => {
                                    println!("✅ Sucesso background: {}", res.message);
                                    let _ = app_clone.notification()
                                        .builder()
                                        .title("Rotina Agendada Concluída")
                                        .body(&res.message)
                                        .show();
                                },
                                Err(e) => {
                                    println!("❌ Falha background: {}", e);
                                    let _ = app_clone.notification()
                                        .builder()
                                        .title("Falha na Rotina de Segurança")
                                        .body(&format!("A rotina '{}' falhou: {}", task_name_clone, e))
                                        .show();
                                }
                            }
                        });
                    }
                }
            }
        }
    }
}