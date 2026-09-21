use rusqlite::Connection;
use chrono::{Local, Datelike, Timelike};
use std::collections::HashMap;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::commands::backup::{execute_advanced_backup, BackupTask};
use crate::commands::engine::execute_rule;

fn get_db_connection() -> Result<Connection, rusqlite::Error> {
    Connection::open("foldex.db")
}

fn should_run(cron: &str, now: &chrono::DateTime<chrono::Local>) -> bool {
    let parts: Vec<&str> = cron.split_whitespace().collect();
    if parts.len() < 5 { return false; }
    
    let c_min = parts[0];
    let c_hour = parts[1];
    let c_dom = parts[2];
    let _c_mon = parts[3]; 
    let c_dow = parts[4];
    
    if c_min != "*" && c_min.parse::<u32>().unwrap_or(99) != now.minute() { return false; }
    if c_hour != "*" && c_hour.parse::<u32>().unwrap_or(99) != now.hour() { return false; }
    
    if c_dom != "*" {
        if c_dom == "L" {
            // Correção recomendada: uso de try_add_days ou tratamento adequado
            let next_day = now.naive_local().date() + chrono::Days::new(1);
            if next_day.month() == now.month() { return false; }
        } else {
            if c_dom.parse::<u32>().unwrap_or(99) != now.day() { return false; }
        }
    }
    
    if c_dow != "*" {
        // CORREÇÃO CRÍTICA DO DOMINGO (Cron):
        // Antes estava `now.weekday().number_from_sunday() % 7`, o que calculava Domingo = 1.
        // O padrão do Cron exige Domingo = 0. A função `num_days_from_sunday()` resolve exatamente isso.
        let dow_num = now.weekday().num_days_from_sunday(); 
        if c_dow.parse::<u32>().unwrap_or(99) != dow_num { return false; }
    }
    
    true
}

pub async fn start_background_watcher(app: AppHandle) {
    println!("🚀 Foldex Orchestrator: Motor Sentinel e Backups iniciados.");
    
    let mut last_run_backup: HashMap<i32, chrono::DateTime<chrono::Local>> = HashMap::new();
    let mut last_run_sentinel: HashMap<i64, chrono::DateTime<chrono::Local>> = HashMap::new();

    loop {
        // O orquestrador respira a cada 15 segundos
        tokio::time::sleep(Duration::from_secs(15)).await;
        
        let now = Local::now();

        // 🛡️ CORREÇÃO DE VAZAMENTO DE MEMÓRIA (O "Acumulador de papéis"):
        // Limpa os registros de regras que rodaram há mais de 24 horas.
        // Assim, o Map não cresce indefinidamente ao longo de meses de uso no Sicoob.
        last_run_sentinel.retain(|_, last| now.signed_duration_since(*last).num_hours() < 24);
        last_run_backup.retain(|_, last| now.signed_duration_since(*last).num_hours() < 24);

        let conn = match get_db_connection() {
            Ok(c) => c,
            Err(_) => continue,
        };

        // ====================================================================
        // 🛡️ MÓDULO 1: SENTINEL (AUTOMAÇÃO DE REGRAS EM BACKGROUND)
        // ====================================================================
        
        let mut rules_to_run = Vec::new();
        
        if let Ok(mut stmt) = conn.prepare("SELECT id, name FROM rules WHERE is_active = 1 AND is_sentinel_active = 1") {
            if let Ok(rows) = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))) {
                for r in rows.flatten() {
                    rules_to_run.push(r);
                }
            }
        }

        for (rule_id, rule_name) in rules_to_run {
            if let Some(last) = last_run_sentinel.get(&rule_id) {
                if now.signed_duration_since(*last).num_seconds() < 45 {
                    continue;
                }
            }

            last_run_sentinel.insert(rule_id, now);
            let app_clone = app.clone();
            
            tokio::spawn(async move {
                match execute_rule(rule_id).await {
                    Ok(msg) => {
                        if !msg.contains("Nenhum arquivo processado") {
                            println!("🛡️ Sentinel processou [{}]: {}", rule_name, msg);
                            
                            let _ = app_clone.notification()
                                .builder()
                                .title("Sentinel em ação")
                                .body(&format!("Sua regra '{}' acabou de ser executada automaticamente.\n{}", rule_name, msg))
                                .show();
                        }
                    },
                    Err(e) => {
                        println!("❌ Erro no Sentinel (Aguardando liberação do Windows) [{}]: {}", rule_name, e);
                    }
                }
            });
        }

        // ====================================================================
        // 💾 MÓDULO 2: ROTINAS DE BACKUP (CRON ORCHESTRATOR)
        // ====================================================================
        
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
                        
                        if let Some(last) = last_run_backup.get(&task_id) {
                            if now.signed_duration_since(*last).num_minutes() < 2 {
                                continue;
                            }
                        }

                        println!("⏳ Orquestrador acionou a rotina de backup: {}", task.task_name);
                        last_run_backup.insert(task_id, now);
                        
                        let task_name_clone = task.task_name.clone();
                        let app_clone = app.clone();

                        tokio::spawn(async move {
                            match execute_advanced_backup(task).await {
                                Ok(res) => {
                                    println!("✅ Sucesso backup: {}", res.message);
                                    let _ = app_clone.notification()
                                        .builder()
                                        .title("Rotina de Backup Concluída")
                                        .body(&res.message)
                                        .show();
                                },
                                Err(e) => {
                                    println!("❌ Falha backup: {}", e);
                                    let _ = app_clone.notification()
                                        .builder()
                                        .title("Falha na Rotina de Segurança")
                                        .body(&format!("O backup '{}' falhou: {}", task_name_clone, e))
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