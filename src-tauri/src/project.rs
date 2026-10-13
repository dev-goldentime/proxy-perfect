use std::fs;
use std::path::Path;

/// Save project JSON supplied by the frontend. The native file dialog chooses the destination.
#[tauri::command]
pub fn save_project(path: String, content: String) -> Result<(), String> {
    let destination = Path::new(&path);
    if destination.extension().and_then(|value| value.to_str())
        .map(|ext| !ext.eq_ignore_ascii_case("pproject") && !ext.eq_ignore_ascii_case("json"))
        .unwrap_or(true)
    {
        return Err("Project files must use the .pproject or .json extension.".to_string());
    }

    // Validate before writing so a malformed project does not replace a good one.
    let parsed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|error| format!("Invalid project JSON: {error}"))?;
    if parsed.get("schemaVersion").and_then(|value| value.as_u64()) != Some(1) {
        return Err("Unsupported project schema version.".to_string());
    }

    fs::write(destination, content).map_err(|error| format!("Could not save project: {error}"))
}

#[tauri::command]
pub fn load_project(path: String) -> Result<String, String> {
    let source = Path::new(&path);
    if !source.is_file() {
        return Err("The selected project file does not exist.".to_string());
    }
    let content = fs::read_to_string(source).map_err(|error| format!("Could not read project: {error}"))?;
    let parsed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|error| format!("Project file is not valid JSON: {error}"))?;
    if parsed.get("schemaVersion").and_then(|value| value.as_u64()) != Some(1) {
        return Err("This project was created by an unsupported version.".to_string());
    }
    Ok(content)
}
