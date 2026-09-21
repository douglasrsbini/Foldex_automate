use std::fs;
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::{Read, Write};
use walkdir::WalkDir;
use zip::write::{SimpleFileOptions, ZipWriter};
use zip::AesMode;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[allow(dead_code)]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub size: u64,
    pub size_formatted: String,
    pub extension: String,
    pub last_modified: String,
    pub modified_at: String,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileProperties {
    pub name: String,
    pub path: String,
    pub full_path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub extension: String,
    pub created_at: String,
    pub modified_at: String,
    pub is_readonly: bool,
    pub readonly: bool,
}

fn format_file_size(size: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if size >= GB {
        format!("{:.2} GB", size as f64 / GB as f64)
    } else if size >= MB {
        format!("{:.2} MB", size as f64 / MB as f64)
    } else if size >= KB {
        format!("{:.2} KB", size as f64 / KB as f64)
    } else {
        format!("{} B", size)
    }
}

fn get_unique_path(dest_dir: &Path, original_name: &str) -> PathBuf {
    let mut target = dest_dir.join(original_name);
    if !target.exists() {
        return target;
    }

    let file_stem = target.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let extension = target.extension().unwrap_or_default().to_string_lossy().to_string();
    
    let mut counter = 1;
    loop {
        let new_name = if extension.is_empty() {
            format!("{} ({})", file_stem, counter)
        } else {
            format!("{} ({}).{}", file_stem, counter, extension)
        };
        
        target = dest_dir.join(&new_name);
        if !target.exists() {
            break;
        }
        counter += 1;
    }
    target
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_default_user_path() -> Result<String, String> {
    match std::env::var("USERPROFILE") {
        Ok(path) => Ok(path),
        Err(_) => match std::env::var("HOME") {
            Ok(path) => Ok(path),
            Err(_) => Err("Não foi possível localizar o diretório padrão do usuário.".into()),
        },
    }
}

#[tauri::command]
pub async fn select_folder_dialog(_title: String) -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
pub fn list_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // ⚡ Usa o WMI nativo do Windows para listar apenas os discos válidos e conectados.
        // Isso evita o travamento (timeout) de 30 segundos causado por unidades de rede desconectadas.
        let output = Command::new("wmic")
            .args(["logicaldisk", "get", "name"])
            .creation_flags(0x08000000) // Esconde a janela do CMD
            .output();

        if let Ok(cmd_res) = output {
            let result_str = String::from_utf8_lossy(&cmd_res.stdout);
            for line in result_str.lines() {
                let trimmed = line.trim();
                // Pega apenas as linhas que têm o formato "C:", "D:", etc.
                if trimmed.len() == 2 && trimmed.ends_with(':') {
                    drives.push(DriveInfo {
                        name: format!("Disco Local ({})", trimmed),
                        path: format!("{}\\", trimmed),
                    });
                }
            }
        } else {
            // Fallback ultra-rápido caso o WMIC falhe (apenas C e D)
            for letter in ['C', 'D'] {
                let drive_path = format!("{}:\\", letter);
                if Path::new(&drive_path).exists() {
                    drives.push(DriveInfo {
                        name: format!("Disco Local ({}:)", letter),
                        path: drive_path,
                    });
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Para Mac e Linux, exibe a raiz.
        drives.push(DriveInfo { name: "Diretório Raiz".into(), path: "/".into() });
    }

    Ok(drives)
}

// ⚡ COMANDO OTIMIZADO PARA ALTA PERFORMANCE
#[tauri::command]
pub async fn list_directory_contents(path: String) -> Result<Vec<FileItem>, String> {
    // ⚡ Deslocamos a leitura pesada para o Tokio em background
    let items = tokio::task::spawn_blocking(move || -> Result<Vec<FileItem>, String> {
        let target_path = Path::new(&path);
        if !target_path.exists() {
            return Err("O diretório informado não existe.".into());
        }

        let entries = fs::read_dir(target_path).map_err(|e| format!("Erro ao ler diretório: {}", e))?;
        let mut items = Vec::new();

        for entry_result in entries {
            if let Ok(entry) = entry_result {
                let p = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                
                // ⚡ Lê do cache rápido do OS ao invés do caminho completo
                let meta = entry.metadata().ok();
                let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                let size_bytes = if is_dir { 0 } else { meta.as_ref().map(|m| m.len()).unwrap_or(0) };
                let size_formatted = format_file_size(size_bytes);
                
                let extension = if is_dir {
                    String::new()
                } else {
                    p.extension().map(|e| e.to_string_lossy().to_string().to_lowercase()).unwrap_or_default()
                };

                let formatted_time = meta.as_ref()
                    .and_then(|m| m.modified().ok())
                    .map(|sys_time| {
                        let dt: chrono::DateTime<chrono::Local> = sys_time.into();
                        dt.format("%d/%m/%Y %H:%M").to_string()
                    })
                    .unwrap_or_else(|| "--/--/---- --:--".to_string());

                items.push(FileItem {
                    name, 
                    path: p.to_string_lossy().to_string(), 
                    is_dir, 
                    size_bytes, 
                    size: size_bytes,
                    size_formatted, 
                    extension, 
                    last_modified: formatted_time.clone(), 
                    modified_at: formatted_time,
                });
            }
        }

        items.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Ok(items)
    }).await.map_err(|e| format!("Falha na thread do explorador: {}", e))??;

    Ok(items)
}

#[tauri::command]
pub fn get_file_properties(path: String) -> Result<FileProperties, String> {
    let p = Path::new(&path);
    if !p.exists() { return Err("Arquivo ou diretório inexistente.".into()); }

    let meta = p.metadata().map_err(|e| e.to_string())?;
    let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let is_dir = p.is_dir();
    let size_bytes = meta.len();
    let size_formatted = format_file_size(size_bytes);
    let is_readonly = meta.permissions().readonly();
    let extension = p.extension().map(|e| e.to_string_lossy().to_string().to_lowercase()).unwrap_or_default();

    let modified_at = meta.modified().ok().map(|sys_time| {
        let dt: chrono::DateTime<chrono::Local> = sys_time.into();
        dt.format("%d/%m/%Y %H:%M").to_string()
    }).unwrap_or_else(|| "--/--/---- --:--".to_string());

    let created_at = meta.created().ok().map(|sys_time| {
        let dt: chrono::DateTime<chrono::Local> = sys_time.into();
        dt.format("%d/%m/%Y %H:%M").to_string()
    }).unwrap_or_else(|| "--/--/---- --:--".to_string());

    Ok(FileProperties {
        name, path: path.clone(), full_path: path, is_dir, size_bytes, size_formatted,
        extension, created_at, modified_at, is_readonly, readonly: is_readonly,
    })
}

#[tauri::command]
pub fn rename_item(path: String, new_name: String) -> Result<String, String> {
    let old_path = Path::new(&path);
    if !old_path.exists() { return Err("O item de origem não foi encontrado.".into()); }
    let parent = old_path.parent().unwrap_or_else(|| Path::new(""));
    let new_path = parent.join(new_name);
    if new_path.exists() { return Err("Já existe um arquivo com este nome no diretório.".into()); }
    fs::rename(old_path, &new_path).map_err(|e| format!("Falha ao renomear: {}", e))?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn paste_item(src_path: String, dest_dir: String, cut: bool) -> Result<String, String> {
    let src = Path::new(&src_path);
    if !src.exists() { return Err("Item de origem não encontrado.".into()); }
    let filename = src.file_name().ok_or("Nome de arquivo inválido.")?.to_string_lossy();
    let dest = get_unique_path(Path::new(&dest_dir), &filename);

    if src.is_file() {
        if cut { fs::rename(&src, &dest).map_err(|e| format!("Falha ao mover arquivo: {}", e))?; }
        else { fs::copy(&src, &dest).map_err(|e| format!("Falha ao copiar arquivo: {}", e))?; }
    } else if src.is_dir() {
        if cut { fs::rename(&src, &dest).map_err(|e| format!("Falha ao mover diretório: {}", e))?; }
        else { copy_dir_all(&src, &dest).map_err(|e| format!("Falha ao copiar diretório: {}", e))?; }
    }
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_folder(parent_dir: String, folder_name: String) -> Result<String, String> {
    let target = Path::new(&parent_dir).join(folder_name);
    if target.exists() { return Err("Esta pasta já existe no diretório informado.".into()); }
    fs::create_dir_all(&target).map_err(|e| format!("Falha ao criar pasta: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_empty_file(parent_dir: String, file_name: String) -> Result<String, String> {
    let target = Path::new(&parent_dir).join(file_name);
    if target.exists() { return Err("Já existe um arquivo com este nome no diretório.".into()); }
    File::create(&target).map_err(|e| format!("Falha ao criar arquivo: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_item(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() { return Err("O item informado já não existe.".into()); }

    if let Ok(metadata) = target.metadata() {
        let mut perms = metadata.permissions();
        if perms.readonly() {
            #[allow(clippy::permissions_set_readonly_false)]
            perms.set_readonly(false);
            let _ = fs::set_permissions(target, perms);
        }
    }

    if target.is_file() { fs::remove_file(target).map_err(|e| format!("Falha ao excluir arquivo: {}", e))?; }
    else if target.is_dir() { fs::remove_dir_all(target).map_err(|e| format!("Falha ao excluir diretório: {}", e))?; }
    Ok(())
}

#[tauri::command]
pub fn compress_items_to_zip(source_paths: Vec<String>, dest_zip: String, password: Option<String>) -> Result<String, String> {
    let path = Path::new(&dest_zip);
    let file = File::create(path).map_err(|e| format!("Erro ao criar arquivo ZIP: {}", e))?;
    let mut zip = ZipWriter::new(file);

    let mut options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    if let Some(ref pass) = password {
        if !pass.trim().is_empty() {
            options = options.with_aes_encryption(AesMode::Aes256, pass);
        }
    }

    let mut buffer = Vec::new();

    for src in source_paths {
        let src_path = Path::new(&src);
        if !src_path.exists() { continue; }

        if src_path.is_file() {
            let name = src_path.file_name().unwrap().to_string_lossy();
            zip.start_file(name, options.clone()).map_err(|e| e.to_string())?;
            let mut f = File::open(src_path).map_err(|e| e.to_string())?;
            f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
            buffer.clear();
        } else {
            for entry in WalkDir::new(src_path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                let name = path.strip_prefix(src_path).unwrap().to_string_lossy();
                
                if path.is_file() {
                    zip.start_file(name.into_owned(), options.clone()).map_err(|e| e.to_string())?;
                    let mut f = File::open(path).map_err(|e| e.to_string())?;
                    f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                    zip.write_all(&buffer).map_err(|e| e.to_string())?;
                    buffer.clear();
                } else if !name.is_empty() {
                    zip.add_directory(name.into_owned(), options.clone()).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    zip.finish().map_err(|e| format!("Erro ao finalizar arquivo ZIP: {}", e))?;
    Ok("Compactação concluída com sucesso.".into())
}

#[tauri::command]
pub fn open_item_natively(path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Falha ao abrir arquivo no Windows: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir arquivo no macOS: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir arquivo no Linux: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_with_dialog(path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args(["shell32.dll,OpenAs_RunDLL", &path])
            .spawn()
            .map_err(|e| format!("Falha ao abrir diálogo de aplicativos: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir no sistema atual: {}", e))?;
    }

    Ok(())
}