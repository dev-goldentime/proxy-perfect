// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![probe_media])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
fn probe_media(path: String) -> Result<String, String> {
    let ffprobe_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../binaries/ffmpeg/ffprobe.exe");

    if !ffprobe_path.is_file() {
        return Err(format!(
            "FFprobe 파일을 찾을 수 없습니다: {}",
            ffprobe_path.display()
        ));
    }

    let output = Command::new(ffprobe_path)
        .args([
            "-v", "error",
            "-show_entries",
            "format=duration,size:stream=codec_type,width,height,avg_frame_rate",
            "-of", "json",
        ])
        .arg(path)
        .output()
        .map_err(|e| format!("FFprobe 실행 실패: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}