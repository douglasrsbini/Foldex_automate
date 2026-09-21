use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuleFilter {
    pub id: Option<i64>,
    pub field_name: String,
    pub operator: String,
    pub value: String,
    pub logic_connector: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuleAction {
    pub id: Option<i64>,
    pub action_type: String,
    pub target_pattern: String,
    // ⚡ Novos campos mapeados
    pub clean_accents: Option<bool>,
    pub replace_spaces: Option<bool>,
    pub case_format: Option<String>,
    pub regex_pattern: Option<String>,
    pub regex_replacement: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rule {
    pub id: Option<i64>,
    pub custom_code: String,
    pub name: String,
    pub source_directory: String,
    pub logic_operator: String,
    pub is_active: bool,
    pub is_sentinel_active: Option<bool>,
    pub conflict_policy: Option<String>,
    pub filters: Vec<RuleFilter>,
    pub actions: Vec<RuleAction>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub modified_at: String,
    pub extension: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileProperties {
    pub name: String,
    pub full_path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub created_at: String,
    pub modified_at: String,
    pub is_readonly: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DryRunResult {
    pub filename: String,
    pub source: String,
    pub destination: String,
    pub action: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLog {
    pub id: Option<i64>,
    pub batch_id: String,
    pub rule_id: Option<i64>,
    pub action_type: String,
    pub original_path: String,
    pub destination_path: Option<String>,
    pub file_size_bytes: i64,
    pub status: String,
    pub executed_at: String,
    pub is_reversible: bool,
    pub file_hash_sha256: Option<String>,
    pub prev_log_hash: Option<String>,
    pub current_log_hash: Option<String>,
    pub windows_user: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IntegrityReport {
    pub is_valid: bool,
    pub total_records: usize,
    pub verified_records: usize,
    pub compromised_id: Option<i64>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseInfo {
    pub is_activated: bool,
    pub user_email: Option<String>,
    pub license_key: Option<String>,
    pub machine_id: String,
    pub plan_name: String,
    pub max_rules: i64,
    pub is_sentinel_allowed: bool,
    pub source_channel: String,
    pub expires_at: Option<String>,
}