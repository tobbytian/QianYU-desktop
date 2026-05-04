import { useState, useCallback, useRef } from "react";

export interface UseTTSOptions {
  onComplete?: (url: string) => void;
  onError?: (error: string) => void;
}

export interface StreamingProgress {
  firstChunkTime: number | null;
  chunksReceived: number;
  bytesReceived: number;
  elapsed: number;
}

export interface StreamingPlaybackState {
  isStreamingPlayback: boolean;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  togglePlay: () => void;
  setVolume: (vol: number) => void;
  stopStreaming: () => void;
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

export function useTTS(options: UseTTSOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [streamingProgress, setStreamingProgress] = useState<StreamingProgress | null>(null);
  const [streamingPlayback, setStreamingPlayback] = useState<StreamingPlaybackState | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const scheduledEndTimeRef = useRef(0);
  const pcmChunksRef = useRef<Uint8Array[]>([]);
  const totalPcmBytesRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playbackStartTimeRef = useRef(0);
  const rafRef = useRef(0);
  const sampleRateRef = useRef(24000);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const streamingCompleteUrlRef = useRef<string | null>(null);

  const updatePlaybackState = useCallback(() => {
    if (!audioCtxRef.current || !isPlayingRef.current) return;

    const currentTime = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
    const totalDuration = totalPcmBytesRef.current / (sampleRateRef.current * 2);

    setStreamingPlayback((prev) =>
      prev
        ? {
            ...prev,
            currentTime: Math.max(0, currentTime),
            totalDuration,
            isPlaying: isPlayingRef.current,
          }
        : null
    );

    if (isPlayingRef.current) {
      rafRef.current = requestAnimationFrame(updatePlaybackState);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (isPlayingRef.current) {
      ctx.suspend();
      isPlayingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      setStreamingPlayback((prev) => (prev ? { ...prev, isPlaying: false } : null));
    } else {
      ctx.resume();
      isPlayingRef.current = true;
      playbackStartTimeRef.current = ctx.currentTime - (totalPcmBytesRef.current > 0 ? totalPcmBytesRef.current / (sampleRateRef.current * 2) : 0);
      rafRef.current = requestAnimationFrame(updatePlaybackState);
      setStreamingPlayback((prev) => (prev ? { ...prev, isPlaying: true } : null));
    }
  }, [updatePlaybackState]);

  const setVolume = useCallback((vol: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = vol;
    }
  }, []);

  const cleanupAudioCtx = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    gainNodeRef.current = null;
    isPlayingRef.current = false;
    scheduledEndTimeRef.current = 0;
    pcmChunksRef.current = [];
    totalPcmBytesRef.current = 0;
  }, []);

  const stopStreaming = useCallback(() => {
    cleanupAudioCtx();
    if (streamingCompleteUrlRef.current) {
      setAudioUrl(streamingCompleteUrlRef.current);
      const audio = new Audio(streamingCompleteUrlRef.current);
      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
      });
    }
    setStreamingPlayback(null);
    streamingCompleteUrlRef.current = null;
  }, [cleanupAudioCtx]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    cleanupAudioCtx();
    streamingCompleteUrlRef.current = null;
    setStreamingPlayback(null);
    setLoading(false);
  }, [cleanupAudioCtx]);

  const generate = useCallback(
    async (apiCall: () => Promise<Blob>) => {
      setLoading(true);
      setError(null);
      setStreamingProgress(null);
      setStreamingPlayback(null);
      cleanupAudioCtx();

      try {
        const blob = await apiCall();

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setAudioUrl(url);

        const audio = new Audio(url);
        audio.addEventListener("loadedmetadata", () => {
          setDuration(audio.duration);
        });

        options.onComplete?.(url);
        return url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        options.onError?.(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [options, cleanupAudioCtx]
  );

  const generateStreaming = useCallback(
    async (apiCall: () => Promise<Response>) => {
      setLoading(true);
      setError(null);
      setAudioUrl(null);
      setStreamingProgress({
        firstChunkTime: null,
        chunksReceived: 0,
        bytesReceived: 0,
        elapsed: 0,
      });
      cleanupAudioCtx();

      const startTime = performance.now();
      let firstChunkTime: number | null = null;
      let chunksReceived = 0;
      let bytesReceived = 0;
      let headerParsed = false;
      let headerBuffer = new Uint8Array(0);
      let leftoverPcm = new Uint8Array(0);

      const timer = setInterval(() => {
        setStreamingProgress({
          firstChunkTime,
          chunksReceived,
          bytesReceived,
          elapsed: performance.now() - startTime,
        });
      }, 100);

      try {
        const response = await apiCall();

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Generation failed: ${errorText}`);
        }

        const contentLength = response.headers.get("content-length");
        const isStreaming = !contentLength;

        if (!isStreaming) {
          const blob = await response.blob();
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setAudioUrl(url);
          const audio = new Audio(url);
          audio.addEventListener("loadedmetadata", () => {
            setDuration(audio.duration);
          });
          options.onComplete?.(url);
          return url;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }
        readerRef.current = reader;

        const ctx = new AudioContext({ sampleRate: 24000 });
        audioCtxRef.current = ctx;

        const gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);
        gainNodeRef.current = gainNode;

        scheduledEndTimeRef.current = ctx.currentTime;
        playbackStartTimeRef.current = ctx.currentTime;
        pcmChunksRef.current = [];
        totalPcmBytesRef.current = 0;

        const BUFFER_COUNT = 3;
        const pendingBuffers: { bytes: Uint8Array; float32: Float32Array }[] = [];
        let playbackStarted = false;

        setStreamingPlayback({
          isStreamingPlayback: true,
          isPlaying: true,
          currentTime: 0,
          totalDuration: 0,
          togglePlay,
          setVolume,
          stopStreaming,
        });

        isPlayingRef.current = true;
        rafRef.current = requestAnimationFrame(updatePlaybackState);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunksReceived++;
          bytesReceived += value.length;

          if (firstChunkTime === null) {
            firstChunkTime = performance.now() - startTime;
          }

          if (!headerParsed) {
            const merged = new Uint8Array(headerBuffer.length + value.length);
            merged.set(headerBuffer);
            merged.set(value, headerBuffer.length);
            headerBuffer = merged;

            if (headerBuffer.length >= 44) {
              const view = new DataView(headerBuffer.buffer, headerBuffer.byteOffset, headerBuffer.byteLength);
              sampleRateRef.current = view.getUint32(24, true);
              headerParsed = true;

              const pcmStart = headerBuffer.slice(44);
              leftoverPcm = pcmStart;
            } else {
              continue;
            }
          } else {
            const merged = new Uint8Array(leftoverPcm.length + value.length);
            merged.set(leftoverPcm);
            merged.set(value, leftoverPcm.length);
            leftoverPcm = merged;
          }

          const BYTES_PER_SAMPLE = 2;
          const SAMPLES_PER_CHUNK = 4096;
          const chunkByteSize = SAMPLES_PER_CHUNK * BYTES_PER_SAMPLE;

          while (leftoverPcm.length >= chunkByteSize) {
            const chunkBytes = leftoverPcm.slice(0, chunkByteSize);
            leftoverPcm = leftoverPcm.slice(chunkByteSize);

            pcmChunksRef.current.push(chunkBytes);
            totalPcmBytesRef.current += chunkBytes.length;

            const int16 = new Int16Array(chunkBytes.buffer, chunkBytes.byteOffset, chunkBytes.length / BYTES_PER_SAMPLE);
            const float32 = int16ToFloat32(int16);

            if (!playbackStarted) {
              pendingBuffers.push({ bytes: chunkBytes, float32 });
              if (pendingBuffers.length >= BUFFER_COUNT) {
                playbackStarted = true;
                playbackStartTimeRef.current = ctx.currentTime;
                scheduledEndTimeRef.current = ctx.currentTime;
                for (const buf of pendingBuffers) {
                  const audioBuffer = ctx.createBuffer(1, buf.float32.length, sampleRateRef.current);
                  audioBuffer.getChannelData(0).set(buf.float32);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(gainNode);
                  source.start(scheduledEndTimeRef.current);
                  scheduledEndTimeRef.current += audioBuffer.duration;
                }
              }
            } else {
              const audioBuffer = ctx.createBuffer(1, float32.length, sampleRateRef.current);
              audioBuffer.getChannelData(0).set(float32);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(gainNode);
              source.start(scheduledEndTimeRef.current);
              scheduledEndTimeRef.current += audioBuffer.duration;
            }
          }
        }

        if (leftoverPcm.length >= 2) {
          const validLength = Math.floor(leftoverPcm.length / 2) * 2;
          const chunkBytes = leftoverPcm.slice(0, validLength);

          if (chunkBytes.length > 0) {
            pcmChunksRef.current.push(chunkBytes);
            totalPcmBytesRef.current += chunkBytes.length;

            const int16 = new Int16Array(chunkBytes.buffer, chunkBytes.byteOffset, chunkBytes.length / 2);
            const float32 = int16ToFloat32(int16);

            if (!playbackStarted) {
              pendingBuffers.push({ bytes: chunkBytes, float32 });
              playbackStarted = true;
              playbackStartTimeRef.current = ctx.currentTime;
              scheduledEndTimeRef.current = ctx.currentTime;
              for (const buf of pendingBuffers) {
                const audioBuffer = ctx.createBuffer(1, buf.float32.length, sampleRateRef.current);
                audioBuffer.getChannelData(0).set(buf.float32);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(gainNode);
                source.start(scheduledEndTimeRef.current);
                scheduledEndTimeRef.current += audioBuffer.duration;
              }
            } else {
              const audioBuffer = ctx.createBuffer(1, float32.length, sampleRateRef.current);
              audioBuffer.getChannelData(0).set(float32);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(gainNode);
              source.start(scheduledEndTimeRef.current);
              scheduledEndTimeRef.current += audioBuffer.duration;
            }
          }
        }

        const totalPcmLength = pcmChunksRef.current.reduce((acc, c) => acc + c.length, 0);
        const headerView = new DataView(new ArrayBuffer(44));
        const nChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRateRef.current * nChannels * bitsPerSample / 8;
        const blockAlign = nChannels * bitsPerSample / 8;
        const dataSize = totalPcmLength;

        headerView.setUint32(0, 0x46464952, true);
        headerView.setUint32(4, 36 + dataSize, true);
        headerView.setUint32(8, 0x45564157, true);
        headerView.setUint32(12, 0x20746D66, true);
        headerView.setUint32(16, 16, true);
        headerView.setUint16(20, 1, true);
        headerView.setUint16(22, nChannels, true);
        headerView.setUint32(24, sampleRateRef.current, true);
        headerView.setUint32(28, byteRate, true);
        headerView.setUint16(32, blockAlign, true);
        headerView.setUint16(34, bitsPerSample, true);
        headerView.setUint32(36, 0x61746164, true);
        headerView.setUint32(40, dataSize, true);

        const wavData = new Uint8Array(44 + totalPcmLength);
        wavData.set(new Uint8Array(headerView.buffer), 0);
        let offset = 44;
        for (const chunk of pcmChunksRef.current) {
          wavData.set(chunk, offset);
          offset += chunk.length;
        }

        const blob = new Blob([wavData], { type: "audio/wav" });
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        streamingCompleteUrlRef.current = url;

        setStreamingProgress({
          firstChunkTime,
          chunksReceived,
          bytesReceived,
          elapsed: performance.now() - startTime,
        });

        const remainingTime = scheduledEndTimeRef.current - ctx.currentTime;
        if (remainingTime > 0) {
          setTimeout(() => {
            if (!streamingCompleteUrlRef.current) return;
            setAudioUrl(url);
            streamingCompleteUrlRef.current = null;
            const audio = new Audio(url);
            audio.addEventListener("loadedmetadata", () => {
              setDuration(audio.duration);
            });
            setStreamingPlayback(null);
            cleanupAudioCtx();
          }, remainingTime * 1000 + 200);
        } else {
          setAudioUrl(url);
          streamingCompleteUrlRef.current = null;
          const audio = new Audio(url);
          audio.addEventListener("loadedmetadata", () => {
            setDuration(audio.duration);
          });
          setStreamingPlayback((prev) =>
            prev ? { ...prev, isStreamingPlayback: false } : null
          );
          cleanupAudioCtx();
        }

        options.onComplete?.(url);
        return url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        options.onError?.(errorMessage);
        cleanupAudioCtx();
        setStreamingPlayback(null);
        throw err;
      } finally {
        clearInterval(timer);
        readerRef.current = null;
        setLoading(false);
      }
    },
    [options, togglePlay, setVolume, stopStreaming, updatePlaybackState, cleanupAudioCtx]
  );

  const cleanup = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setAudioUrl(null);
    }
    streamingCompleteUrlRef.current = null;
    setStreamingProgress(null);
    setStreamingPlayback(null);
    cleanupAudioCtx();
  }, [cleanupAudioCtx]);

  return {
    loading,
    error,
    audioUrl,
    duration,
    streamingProgress,
    streamingPlayback,
    generate,
    generateStreaming,
    stopGeneration,
    cleanup,
  };
}
