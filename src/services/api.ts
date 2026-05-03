/**
 * QianYU TTS API Service
 * 直接调用原项目 tts_api_unified.py 的API
 */

const BASE_URL = "http://127.0.0.1:8088";

export interface TTSRequest {
  text: string;
  voice?: string;
  language?: string;
  voice_description?: string;
  speaker?: string;
  ref_audio_path?: string;
  ref_text?: string;
}

export interface TTSResponse {
  audio: number[];
  sample_rate: number;
  duration: number;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  mode: string;
  error?: string;
}

export interface Voice {
  id: string;
  name: string;
  created_at?: string;
}

// 生成语音（使用原项目API）
export async function generateAudio(request: TTSRequest): Promise<TTSResponse> {
  const { text, voice = "voice_003" } = request;

  const response = await fetch(`${BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: voice,
      response_format: "wav",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Generation failed: ${error}`);
  }

  // 获取音频数据
  const arrayBuffer = await response.arrayBuffer();
  const audioData = parseWavToFloat32(arrayBuffer);

  return {
    audio: audioData,
    sample_rate: 24000,
    duration: audioData.length / 24000,
  };
}

// 健康检查
export async function healthCheck(): Promise<HealthResponse> {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) {
    throw new Error("Health check failed");
  }
  return response.json();
}

// 获取已保存的声音列表
export async function getVoices(): Promise<Voice[]> {
  const response = await fetch(`${BASE_URL}/v1/voices`);
  if (!response.ok) {
    throw new Error("Failed to get voices");
  }
  const data = await response.json();
  return data.voices || [];
}

// 解析WAV为Float32数组
function parseWavToFloat32(arrayBuffer: ArrayBuffer): number[] {
  const view = new DataView(arrayBuffer);

  // 跳过WAV头（44字节）
  const dataOffset = 44;
  const dataLength = arrayBuffer.byteLength - dataOffset;
  const sampleCount = dataLength / 2; // 16-bit samples

  const samples: number[] = new Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const intSample = view.getInt16(dataOffset + i * 2, true);
    samples[i] = intSample / 32768.0; // 转换为 -1.0 到 1.0
  }

  return samples;
}

// 保存音频文件（通过Tauri）
export async function saveAudioFile(filePath: string, audioData: number[], sampleRate: number): Promise<void> {
  // 调用Tauri命令保存文件
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("save_audio_file", { filePath, audioData, sampleRate });
}

// 打开保存对话框
export async function openSaveDialog(defaultFilename: string): Promise<string | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("open_save_dialog", { defaultFilename });
}

// 打开文件夹对话框
export async function openFolderDialog(): Promise<string | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("open_folder_dialog");
}
