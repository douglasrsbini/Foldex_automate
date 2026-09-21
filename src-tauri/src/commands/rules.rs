use crate::db::schema::get_db_path;
use crate::models::{Rule, RuleAction, RuleFilter};
use rusqlite::{params, Connection, Result};

#[tauri::command]
pub fn get_rules() -> Result<Vec<Rule>, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    
    // ⚡ Tenta adicionar as colunas novas caso o banco seja antigo (Evita quebrar o app de quem já instalou)
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN clean_accents INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN replace_spaces INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN case_format TEXT DEFAULT 'NONE'", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN regex_pattern TEXT", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN regex_replacement TEXT", []);

    let mut stmt = conn
        .prepare("SELECT id, custom_code, name, source_directory, logic_operator, is_active, conflict_policy, is_sentinel_active FROM rules WHERE is_active = 1 ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rule_iter = stmt
        .query_map([], |row| {
            Ok(Rule {
                id: Some(row.get(0)?),
                custom_code: row.get(1)?,
                name: row.get(2)?,
                source_directory: row.get(3)?,
                logic_operator: row.get(4)?,
                is_active: row.get::<_, i64>(5)? == 1,
                conflict_policy: row.get(6).unwrap_or(Some("AUTONUMBER".to_string())),
                is_sentinel_active: Some(row.get::<_, Option<i64>>(7)?.unwrap_or(0) == 1),
                filters: Vec::new(),
                actions: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut rules = Vec::new();
    for r in rule_iter.flatten() {
        let mut rule = r;
        let r_id = rule.id.unwrap();

        let mut f_stmt = conn
            .prepare("SELECT id, field_name, operator, value, logic_connector FROM rule_filters WHERE rule_id = ?")
            .map_err(|e| e.to_string())?;
        let f_iter = f_stmt
            .query_map([r_id], |row| {
                Ok(RuleFilter {
                    id: Some(row.get(0)?),
                    field_name: row.get(1)?,
                    operator: row.get(2)?,
                    value: row.get(3)?,
                    logic_connector: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rule.filters = f_iter.flatten().collect();

        // ⚡ Leitura dos novos campos de higienização
        let mut a_stmt = conn
            .prepare("SELECT id, action_type, target_pattern, clean_accents, replace_spaces, case_format, regex_pattern, regex_replacement FROM rule_actions WHERE rule_id = ?")
            .map_err(|e| e.to_string())?;
        let a_iter = a_stmt
            .query_map([r_id], |row| {
                Ok(RuleAction {
                    id: Some(row.get(0)?),
                    action_type: row.get(1)?,
                    target_pattern: row.get(2)?,
                    clean_accents: Some(row.get::<_, Option<i64>>(3)?.unwrap_or(0) == 1),
                    replace_spaces: Some(row.get::<_, Option<i64>>(4)?.unwrap_or(0) == 1),
                    case_format: row.get(5)?,
                    regex_pattern: row.get(6)?,
                    regex_replacement: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rule.actions = a_iter.flatten().collect();

        rules.push(rule);
    }

    Ok(rules)
}

#[tauri::command]
pub fn save_rule(rule: Rule) -> Result<String, String> {
    let mut conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    
    // Garantia de schema para updates
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN clean_accents INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN replace_spaces INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN case_format TEXT DEFAULT 'NONE'", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN regex_pattern TEXT", []);
    let _ = conn.execute("ALTER TABLE rule_actions ADD COLUMN regex_replacement TEXT", []);

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let policy = rule.conflict_policy.as_deref().unwrap_or("AUTONUMBER");
    let sentinel = if rule.is_sentinel_active.unwrap_or(false) { 1 } else { 0 };

    if let Some(id) = rule.id {
        tx.execute(
            "UPDATE rules SET custom_code = ?1, name = ?2, source_directory = ?3, logic_operator = ?4, conflict_policy = ?5, is_sentinel_active = ?6 WHERE id = ?7",
            params![rule.custom_code, rule.name, rule.source_directory, rule.logic_operator, policy, sentinel, id],
        ).map_err(|e| e.to_string())?;

        tx.execute("DELETE FROM rule_filters WHERE rule_id = ?", [id]).map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM rule_actions WHERE rule_id = ?", [id]).map_err(|e| e.to_string())?;

        for f in &rule.filters {
            tx.execute(
                "INSERT INTO rule_filters (rule_id, field_name, operator, value, logic_connector) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, f.field_name, f.operator, f.value, f.logic_connector.as_deref().unwrap_or("AND")],
            ).map_err(|e| e.to_string())?;
        }

        // ⚡ Gravando os novos campos na edição
        for a in &rule.actions {
            tx.execute(
                "INSERT INTO rule_actions (rule_id, action_type, target_pattern, clean_accents, replace_spaces, case_format, regex_pattern, regex_replacement) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    id, a.action_type, a.target_pattern, 
                    if a.clean_accents.unwrap_or(false) { 1 } else { 0 },
                    if a.replace_spaces.unwrap_or(false) { 1 } else { 0 },
                    a.case_format.as_deref().unwrap_or("NONE"),
                    a.regex_pattern,
                    a.regex_replacement
                ],
            ).map_err(|e| e.to_string())?;
        }
    } else {
        tx.execute(
            "INSERT INTO rules (custom_code, name, source_directory, logic_operator, is_active, conflict_policy, is_sentinel_active) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)",
            params![rule.custom_code, rule.name, rule.source_directory, rule.logic_operator, policy, sentinel],
        ).map_err(|e| e.to_string())?;

        let new_id = tx.last_insert_rowid();

        for f in &rule.filters {
            tx.execute(
                "INSERT INTO rule_filters (rule_id, field_name, operator, value, logic_connector) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![new_id, f.field_name, f.operator, f.value, f.logic_connector.as_deref().unwrap_or("AND")],
            ).map_err(|e| e.to_string())?;
        }

        // ⚡ Gravando os novos campos na criação
        for a in &rule.actions {
            tx.execute(
                "INSERT INTO rule_actions (rule_id, action_type, target_pattern, clean_accents, replace_spaces, case_format, regex_pattern, regex_replacement) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    new_id, a.action_type, a.target_pattern,
                    if a.clean_accents.unwrap_or(false) { 1 } else { 0 },
                    if a.replace_spaces.unwrap_or(false) { 1 } else { 0 },
                    a.case_format.as_deref().unwrap_or("NONE"),
                    a.regex_pattern,
                    a.regex_replacement
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Regra salva com sucesso!".into())
}

#[tauri::command]
pub fn delete_rule(rule_id: i64) -> Result<(), String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM rules WHERE id = ?", [rule_id]).map_err(|e| e.to_string())?;
    Ok(())
}