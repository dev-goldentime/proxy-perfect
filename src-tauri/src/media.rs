use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Read metadata from a selected media file using the local FFprobe executable.
/// This development path expects binaries/ffmpeg/ffprobe.exe beside the project root.
#[tauri::command]
pub fn probe_media(path: String) -> Result<Value, String> {
    let media_path = Path::new(&path);
    if !media_path.is_file() {
        return Err("The selected media file does not exist or is not a file.".to_string());
    }

    #[cfg(target_os = "windows")]
    let executable_name = "ffprobe.exe";
    #[cfg(not(target_os = "windows"))]
    let executable_name = "ffprobe";

    let executable = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..").join("binaries").join("ffmpeg").join(executable_name);

    if !executable.is_file() {
        return Err(format!(
            "FFprobe was not found at {}. Place it in binaries/ffmpeg/.",
            executable.display()
        ));
    }

    let output = Command::new(&executable)
        .args([
            "-v", "error",
            "-show_entries",
            "format=duration,size,format_name:stream=codec_type,width,height,avg_frame_rate,r_frame_rate,codec_name",
            "-of", "json",
        ])
        .arg(media_path)
        .output()
        .map_err(|error| format!("Could not start FFprobe: {error}"))?;

    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() { "FFprobe could not analyze this file.".to_string() } else { message });
    }

    serde_json::from_slice::<Value>(&output.stdout)
        .map_err(|error| format!("FFprobe returned invalid JSON: {error}"))
}
