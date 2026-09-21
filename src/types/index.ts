export interface DriveInfo {
  name: string;
  path: string;
}

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes?: number;
  size?: number;
  size_formatted?: string;
  extension?: string;
  last_modified?: string;
  modified_at?: string;
}

export interface FileProperties {
  name: string;
  path?: string;
  full_path?: string;
  is_dir: boolean;
  size_bytes?: number;
  size_formatted?: string;
  extension?: string;
  created_at?: string;
  modified_at?: string;
  is_readonly?: boolean;
  readonly?: boolean;
}

export interface RuleFilter {
  field_name: string;
  operator: string;
  value: string;
  logic_connector?: string;
}

export interface RuleAction {
  id?: number;
  action_type: string;
  target_pattern: string;
  clean_accents?: boolean;
  replace_spaces?: boolean;
  case_format?: string; // 'NONE', 'UPPER', 'LOWER'
  regex_pattern?: string;
  regex_replacement?: string;
}

export interface Rule {
  id?: number;
  custom_code: string;
  name: string;
  source_directory: string;
  logic_operator: string;
  is_active: boolean;
  conflict_policy?: string;
  is_sentinel_active?: boolean;
  filters: RuleFilter[];
  actions: RuleAction[];
}

export interface DryRunResult {
  filename: string;
  source: string;
  destination: string;
  action: string;
}

export interface AuditLog {
  id?: number;
  batch_id: string;
  rule_id: number;
  action_type: string;
  original_path: string;
  destination_path: string;
  file_size_bytes: number;
  status: string;
  executed_at?: string;
  is_reversible: boolean;
  file_hash_sha256?: string;
  prev_log_hash?: string;
  current_log_hash?: string;
  windows_user?: string;
}

export interface IntegrityReport {
  is_valid: boolean;
  total_records: number;
  verified_records: number;
  compromised_id?: number;
  message: string;
}

export interface LicenseInfo {
  is_activated: boolean;
  user_email?: string;
  license_key?: string;
  machine_id: string;
  plan_name: string;
  max_rules: number;
  is_sentinel_allowed: boolean;
  source_channel: string;
  expires_at?: string;
}