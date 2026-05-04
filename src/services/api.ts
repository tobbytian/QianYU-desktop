/**
 * QianYU TTS API Service
 * 直接调用 tts_api_unified.py 的 API
 */

const BASE_URL = "http://127.0.0.1:8088";

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  current_model: string | null;
  mode: string;
  error?: string;
}

export interface Voice {
  id: string;
  name: string;
  created_at?: string;
}

// ── 声音设计 (Voice Design) ──
export async function generateVoiceDesign(
  text: string,
  language: string,
  voiceDescription: string,
): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      response_format: "wav",
      language: language,
      voice_description: voiceDescription,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voice Design failed: ${error}`);
  }

  return response.blob();
}

// ── 自定义音色 (Custom Voice) ──
export async function generateCustomVoice(
  text: string,
  language: string,
  speaker: string,
  instruct?: string,
): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      response_format: "wav",
      language: language,
      speaker: speaker,
      voice_description: instruct || "",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Custom Voice failed: ${error}`);
  }

  return response.blob();
}

// ── 语音克隆 - 使用已保存音色 ──
export async function generateVoiceCloneSaved(
  text: string,
  language: string,
  voiceId: string,
): Promise<Blob> {
  const response = await fetch(`${BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: voiceId,
      response_format: "wav",
      language: language,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voice Clone failed: ${error}`);
  }

  return response.blob();
}

// ── 语音克隆 - 上传参考音频 ──
export async function generateVoiceCloneUpload(
  text: string,
  language: string,
  refAudioFile: File,
  refText?: string,
): Promise<Blob> {
  const form = new FormData();
  form.append("text", text);
  form.append("language", language);
  form.append("ref_audio", refAudioFile);
  if (refText) {
    form.append("ref_text", refText);
  }

  const response = await fetch(`${BASE_URL}/v1/audio/speech/upload`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voice Clone upload failed: ${error}`);
  }

  return response.blob();
}

// ── 健康检查 ──
export async function healthCheck(): Promise<HealthResponse> {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) {
    throw new Error("Health check failed");
  }
  return response.json();
}

// ── 已保存音色列表 ──
export async function getVoices(): Promise<Voice[]> {
  const response = await fetch(`${BASE_URL}/v1/voices`);
  if (!response.ok) {
    throw new Error("Failed to get voices");
  }
  const data = await response.json();
  return data.voices || [];
}

// ── 保存音色 ──
export async function saveVoice(
  name: string,
  refAudioFile: File,
  refText?: string,
): Promise<{ voice_id: string; name: string }> {
  const form = new FormData();
  form.append("name", name);
  form.append("ref_audio", refAudioFile);
  if (refText) {
    form.append("ref_text", refText);
  }

  const response = await fetch(`${BASE_URL}/v1/voices`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Save voice failed: ${error}`);
  }

  return response.json();
}

// ── 删除音色 ──
export async function deleteVoice(voiceId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/v1/voices/${voiceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delete voice failed: ${error}`);
  }
}
