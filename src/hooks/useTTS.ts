import { useState, useCallback, useRef } from "react";

export interface UseTTSOptions {
  onComplete?: (url: string) => void;
  onError?: (error: string) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const blobUrlRef = useRef<string | null>(null);

  const generate = useCallback(
    async (apiCall: () => Promise<Blob>) => {
      setLoading(true);
      setError(null);

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
    [options]
  );

  const cleanup = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setAudioUrl(null);
    }
  }, []);

  return {
    loading,
    error,
    audioUrl,
    duration,
    generate,
    cleanup,
  };
}
