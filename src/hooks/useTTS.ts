import { useState, useCallback } from "react";
import { generateAudio, type TTSRequest, type TTSResponse } from "@/services/api";

export interface UseTTSOptions {
  onComplete?: (response: TTSResponse) => void;
  onError?: (error: string) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<number[] | null>(null);
  const [sampleRate, setSampleRate] = useState<number>(24000);
  const [duration, setDuration] = useState<number>(0);

  const generate = useCallback(
    async (request: TTSRequest) => {
      setLoading(true);
      setError(null);
      setAudioUrl(null);
      setAudioData(null);

      try {
        const response = await generateAudio(request);

        // Store raw audio data
        setAudioData(response.audio);
        setSampleRate(response.sample_rate);
        setDuration(response.duration);

        // Convert to WAV blob for playback
        const wavBlob = float32ToWav(response.audio, response.sample_rate);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);

        options.onComplete?.(response);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        options.onError?.(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const cleanup = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  return {
    loading,
    error,
    audioUrl,
    audioData,
    sampleRate,
    duration,
    generate,
    cleanup,
  };
}

function float32ToWav(float32Array: number[], sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = float32Array.length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Audio data
  let offset = 44;
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
