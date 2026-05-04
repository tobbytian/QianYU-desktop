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

// ── 重命名音色 ──
export async function renameVoice(voiceId: string, name: string): Promise<{ voice_id: string; name: string }> {
  const form = new FormData();
  form.append("name", name);

  const response = await fetch(`${BASE_URL}/v1/voices/${voiceId}`, {
    method: "PATCH",
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Rename voice failed: ${error}`);
  }

  return response.json();
}

// ── 批量删除音色 ──
export async function batchDeleteVoices(voiceIds: string[]): Promise<{ deleted: string[] }> {
  const form = new FormData();
  voiceIds.forEach((id) => form.append("voice_ids", id));

  const response = await fetch(`${BASE_URL}/v1/voices/batch-delete`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Batch delete failed: ${error}`);
  }

  return response.json();
}

// ── 导出音色 ──
export interface ExportVoiceData {
  id: string;
  name: string;
  created_at: string;
  ref_text: string;
  data_b64: string;
}

export async function exportVoices(voiceIds?: string[]): Promise<{ voices: ExportVoiceData[] }> {
  const params = voiceIds?.length ? `?voice_ids=${voiceIds.join(",")}` : "";
  const response = await fetch(`${BASE_URL}/v1/voices/export${params}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Export voices failed: ${error}`);
  }

  return response.json();
}

// ── 导入音色 ──
export async function importVoices(file: File): Promise<{ imported: string[] }> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${BASE_URL}/v1/voices/import`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Import voices failed: ${error}`);
  }

  return response.json();
}

// ── 设置：流式/非流式模式 ──
export async function setStreamingMode(mode: "streaming" | "non-streaming"): Promise<{ mode: string }> {
  const response = await fetch(`${BASE_URL}/api/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Set mode failed: ${error}`);
  }

  return response.json();
}

// ── 设置：Chunk Size ──
export async function setChunkSize(size: number): Promise<{ chunk_size: number }> {
  const response = await fetch(`${BASE_URL}/api/chunk-size`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Set chunk size failed: ${error}`);
  }

  return response.json();
}

// ── 模型管理：获取模型信息 ──
export interface ModelsResponse {
  models: Record<string, string>;
  current: string | null;
  loaded: boolean;
}

export async function getModels(): Promise<ModelsResponse> {
  const response = await fetch(`${BASE_URL}/api/models`);
  if (!response.ok) {
    throw new Error("Failed to get models");
  }
  return response.json();
}

// ── 模型管理：加载模型 ──
export async function loadModel(mode: string): Promise<{ status: string; mode: string }> {
  const form = new FormData();
  form.append("mode", mode);

  const response = await fetch(`${BASE_URL}/api/models/load`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Load model failed: ${error}`);
  }

  return response.json();
}

// ── 模型管理：卸载模型 ──
export async function unloadModel(): Promise<{ status: string }> {
  const response = await fetch(`${BASE_URL}/api/models/unload`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Unload model failed: ${error}`);
  }

  return response.json();
}

// ── 流式语音生成 ──
export async function generateVoiceDesignStreaming(
  text: string,
  language: string,
  voiceDescription: string,
): Promise<Response> {
  return fetch(`${BASE_URL}/v1/audio/speech`, {
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
}

export async function generateCustomVoiceStreaming(
  text: string,
  language: string,
  speaker: string,
  instruct?: string,
): Promise<Response> {
  return fetch(`${BASE_URL}/v1/audio/speech`, {
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
}

export async function generateVoiceCloneSavedStreaming(
  text: string,
  language: string,
  voiceId: string,
): Promise<Response> {
  return fetch(`${BASE_URL}/v1/audio/speech`, {
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
}

export async function generateVoiceCloneUploadStreaming(
  text: string,
  language: string,
  refAudioFile: File,
  refText?: string,
): Promise<Response> {
  const form = new FormData();
  form.append("text", text);
  form.append("language", language);
  form.append("ref_audio", refAudioFile);
  if (refText) {
    form.append("ref_text", refText);
  }

  return fetch(`${BASE_URL}/v1/audio/speech/upload`, {
    method: "POST",
    body: form,
  });
}
