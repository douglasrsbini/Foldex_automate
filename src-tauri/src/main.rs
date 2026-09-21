#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod models;
mod commands;
mod services;

use db::schema::init_database;
use commands::explorer::*;
use commands::rules::*;
use commands::engine::*;
use services::watcher::start_background_watcher;
use commands::backup::*;

fn main() {
    if let Err(e) = init_database() {
        eprintln!("Erro ao inicializar banco de dados: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_background_watcher(handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 📁 Comandos do Explorador de Pastas
            get_default_user_path,
            select_folder_dialog,
            list_drives,
            list_directory_contents,
            get_file_properties,
            rename_item,
            paste_item,
            create_folder,
            create_empty_file,
            delete_item,
            compress_items_to_zip,
            open_item_natively,
            open_with_dialog,

            // ⚙️ Comandos de Regras
            get_rules,
            save_rule,
            delete_rule,
            toggle_sentinel_rule,

            // 🚀 Comandos do Motor (Engine), Auditoria e Licença
            run_simulation,
            execute_rule,
            get_audit_logs,
            rollback_batch,
            rollback_last_batch,
            rollback_single_item,
            rollback_multiple_items,
            get_hardware_machine_id,
            get_license_status,
            request_login_code,
            verify_login_code,
            activate_store_license,
            logout_license,
            verify_audit_integrity,
            save_setting,
            show_system_notification,
            admin_change_plan,
            smart_organize_folder,

            // 💾 Comandos de Backup
            get_backup_tasks,
            save_backup_task,
            delete_backup_task,
            get_backup_logs,
            execute_advanced_backup,

            //🤖IA Copilot Command
            generate_rule_via_ai,
            chat_with_foldex_agent
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar aplicação Tauri");
}