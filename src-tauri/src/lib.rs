use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct TTSRequest {
    pub text: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ref_audio_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ref_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub streaming: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunk_size: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TTSResponse {
    pub audio: Vec<f32>,
    pub sample_rate: u32,
    pub duration: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Voice {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub cuda_available: bool,
    pub model_loaded: bool,
    pub model_type: Option<String>,
    pub model_paths: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelPathsResponse {
    pub default: std::collections::HashMap<String, String>,
    pub custom: std::collections::HashMap<String, String>,
    pub current: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadModelRequest {
    pub model_type: String,
    pub model_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ErrorResponse {
    detail: String,
}

pub struct AppState {
    pub server_url: Mutex<Option<String>>,
}

async fn make_request<T: serde::de::DeserializeOwned>(
    server_url: &str,
    method: &str,
    path: &str,
    body: Option<impl Serialize>,
) -> Result<T, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", server_url, path);

    let response = match method {
        "GET" => client.get(&url).send().await,
        "POST" => {
            let mut req = client.post(&url);
            if let Some(b) = body {
                req = req.json(&b);
            }
            req.send().await
        }
        "DELETE" => client.delete(&url).send().await,
        _ => return Err(format!("Unsupported method: {}", method)),
    }
    .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        if let Ok(error) = serde_json::from_str::<ErrorResponse>(&response_text) {
            return Err(format!("Server error: {}", error.detail));
        }
        return Err(format!("Server error (HTTP {}): {}", status, response_text));
    }

    serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {}", e))
}

#[tauri::command]
async fn connect_server(
    state: State<'_, AppState>,
    url: String,
) -> Result<String, String> {
    *state.server_url.lock().unwrap() = Some(url.clone());
    Ok(url)
}

#[tauri::command]
async fn generate_audio(
    state: State<'_, AppState>,
    request: TTSRequest,
) -> Result<TTSResponse, String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    make_request(&server_url, "POST", "/api/generate", Some(request)).await
}

#[tauri::command]
async fn get_voices(state: State<'_, AppState>) -> Result<Vec<Voice>, String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    make_request(&server_url, "GET", "/api/voices", None::<()>).await
}

#[tauri::command]
async fn save_voice(
    state: State<'_, AppState>,
    name: String,
    ref_audio_path: String,
    ref_text: Option<String>,
) -> Result<String, String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    let body = serde_json::json!({
        "name": name,
        "ref_audio_path": ref_audio_path,
        "ref_text": ref_text
    });

    let result: serde_json::Value = make_request(&server_url, "POST", "/api/voices", Some(body)).await?;
    Ok(result["voice_id"].as_str().unwrap_or("").to_string())
}

#[tauri::command]
async fn delete_voice(state: State<'_, AppState>, voice_id: String) -> Result<(), String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    make_request(&server_url, "DELETE", &format!("/api/voices/{}", voice_id), None::<()>).await
}

#[tauri::command]
async fn health_check(state: State<'_, AppState>) -> Result<HealthResponse, String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    make_request(&server_url, "GET", "/api/health", None::<()>).await
}

#[tauri::command]
async fn get_model_paths(state: State<'_, AppState>) -> Result<ModelPathsResponse, String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    make_request(&server_url, "GET", "/api/model/paths", None::<()>).await
}

#[tauri::command]
async fn set_model_paths(
    state: State<'_, AppState>,
    paths: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    make_request(&server_url, "POST", "/api/model/paths", Some(paths)).await
}

#[tauri::command]
async fn load_model(
    state: State<'_, AppState>,
    model_type: String,
    model_path: Option<String>,
) -> Result<(), String> {
    let server_url = state
        .server_url
        .lock()
        .unwrap()
        .clone()
        .ok_or("Server not connected")?;

    let request = LoadModelRequest {
        model_type,
        model_path,
    };

    make_request(&server_url, "POST", "/api/model/load", Some(request)).await
}

#[tauri::command]
async fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let folder = app.dialog().file().blocking_pick_folder();
    
    match folder {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
async fn open_save_dialog(app: tauri::AppHandle, default_filename: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let path = app.dialog()
        .file()
        .set_file_name(&default_filename)
        .add_filter("WAV Audio", &["wav"])
        .blocking_save_file();
    
    match path {
        Some(p) => Ok(Some(p.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
async fn save_audio_file(file_path: String, audio_data: Vec<f32>, sample_rate: u32) -> Result<(), String> {
    let wav_bytes = convert_to_wav(&audio_data, sample_rate);
    std::fs::write(&file_path, wav_bytes).map_err(|e| format!("Failed to save file: {}", e))
}

fn convert_to_wav(audio_data: &[f32], sample_rate: u32) -> Vec<u8> {
    let num_channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let bytes_per_sample = bits_per_sample / 8;
    let block_align = num_channels * bytes_per_sample;
    let byte_rate = sample_rate * block_align as u32;
    let data_size = audio_data.len() as u32 * bytes_per_sample as u32;
    let buffer_size = 44 + data_size;
    
    let mut wav = Vec::with_capacity(buffer_size as usize);
    
    // RIFF header
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(buffer_size - 8).to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    
    // fmt chunk
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes()); // chunk size
    wav.extend_from_slice(&1u16.to_le_bytes());  // PCM format
    wav.extend_from_slice(&num_channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&bits_per_sample.to_le_bytes());
    
    // data chunk
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    
    // audio data (f32 to i16)
    for &sample in audio_data {
        let clamped = sample.max(-1.0).min(1.0);
        let int_sample = if clamped < 0.0 {
            (clamped * 32768.0) as i16
        } else {
            (clamped * 32767.0) as i16
        };
        wav.extend_from_slice(&int_sample.to_le_bytes());
    }
    
    wav
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            server_url: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            connect_server,
            generate_audio,
            get_voices,
            save_voice,
            delete_voice,
            health_check,
            get_model_paths,
            set_model_paths,
            load_model,
            open_folder_dialog,
            open_save_dialog,
            save_audio_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
