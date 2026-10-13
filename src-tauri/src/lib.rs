// Integration template for a standard Tauri 2 + React project.
// Merge these modules/commands into your existing lib.rs instead of replacing
// custom plugins or setup code you already have.

mod media;
mod project;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Keep this plugin if it is already registered in your current project.
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            media::probe_media,
            project::save_project,
            project::load_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
