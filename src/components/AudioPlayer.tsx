import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  SkipBack,
  SkipForward,
  Music,
  Radio,
} from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import type { StreamingPlaybackState } from "@/hooks/useTTS";

interface AudioPlayerProps {
  url: string | null;
  duration: number;
  onCleanup?: () => void;
  streamingPlayback?: StreamingPlaybackState | null;
}

export function AudioPlayer({ url, duration, onCleanup, streamingPlayback }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const isStreamingMode = streamingPlayback?.isStreamingPlayback ?? false;
  const hasCompleteAudio = !!url;

  useEffect(() => {
    return () => {
      onCleanup?.();
    };
  }, [onCleanup]);

  useEffect(() => {
    if (hasCompleteAudio) {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      if (playheadRef.current) playheadRef.current.style.left = "0%";
      if (timeRef.current) timeRef.current.textContent = "0:00";
    }
  }, [url, hasCompleteAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasCompleteAudio || isStreamingMode) return;

    const formatTime = (t: number) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const tick = () => {
      const t = audio.currentTime;
      const pct = duration > 0 ? (t / duration) * 100 : 0;

      if (playheadRef.current) {
        playheadRef.current.style.left = `${pct}%`;
      }
      if (timeRef.current) {
        timeRef.current.textContent = formatTime(t);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const handlePlay = () => {
      rafRef.current = requestAnimationFrame(tick);
    };
    const handlePause = () => cancelAnimationFrame(rafRef.current);
    const handleEnded = () => {
      cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [url, duration, hasCompleteAudio, isStreamingMode]);

  const togglePlay = () => {
    if (isStreamingMode && streamingPlayback) {
      streamingPlayback.togglePlay();
      return;
    }

    const audio = audioRef.current;
    if (!audio || !url) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    if (isStreamingMode) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    const pct = duration > 0 ? (time / duration) * 100 : 0;
    if (playheadRef.current) playheadRef.current.style.left = `${pct}%`;
    if (timeRef.current) {
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      timeRef.current.textContent = `${m}:${s.toString().padStart(2, "0")}`;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);

    if (isStreamingMode && streamingPlayback) {
      streamingPlayback.setVolume(vol);
      return;
    }

    const audio = audioRef.current;
    if (audio) audio.volume = vol;
  };

  const toggleMute = () => {
    if (isStreamingMode && streamingPlayback) {
      if (isMuted) {
        streamingPlayback.setVolume(volume);
        setIsMuted(false);
      } else {
        streamingPlayback.setVolume(0);
        setIsMuted(true);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const skipBackward = () => {
    if (isStreamingMode) return;
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
  };

  const skipForward = () => {
    if (isStreamingMode) return;
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.min(duration, audio.currentTime + 5);
  };

  const handleDownload = async () => {
    if (!url) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const defaultName = `qianyu-tts-${Date.now()}.wav`;
      const filePath = await invoke<string | null>("open_save_dialog", { defaultFilename: defaultName });
      if (!filePath) return;

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      await invoke("save_bytes", { filePath, data: bytes });
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const currentDisplayTime = isStreamingMode ? (streamingPlayback?.currentTime ?? 0) : 0;
  const currentDuration = isStreamingMode ? (streamingPlayback?.totalDuration ?? 0) : duration;
  const showPlaying = isStreamingMode ? (streamingPlayback?.isPlaying ?? false) : isPlaying;

  if (!url && !isStreamingMode) {
    return (
      <div className="backdrop-blur-xl bg-white/40 dark:bg-white/[0.03] rounded-2xl p-6 border border-dashed border-gray-200/60 dark:border-white/[0.08]">
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <Music className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">等待生成音频...</p>
        </div>
      </div>
    );
  }

  if (isStreamingMode) {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-gray-900/[0.08] to-gray-900/[0.08] dark:from-white/[0.06] dark:to-white/[0.06] rounded-2xl p-6 border border-gray-300/20 dark:border-gray-400/10 shadow-lg shadow-gray-900/[0.05]">
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-2 text-gray-700 dark:text-white">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="font-medium text-sm">正在播放...</span>
          </div>

          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{formatTime(currentDisplayTime)}</span>
            <span>{formatTime(currentDuration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={skipBackward}
                className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                disabled
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white text-white rounded-full flex items-center justify-center hover:brightness-110 transition-all duration-200 shadow-lg shadow-gray-900/30 shadow-gray-100/20"
              >
                {showPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>

              <button
                onClick={skipForward}
                className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                disabled
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-200 dark:bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-gray-700 dark:accent-white"
              />
              {streamingPlayback && (
                <button
                  onClick={() => streamingPlayback.stopStreaming()}
                  className="flex items-center space-x-1 px-3 py-2 backdrop-blur-lg bg-white/30 dark:bg-white/[0.06] border border-white/20 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 rounded-xl hover:bg-white/50 dark:hover:bg-white/[0.08] transition-all duration-200 text-sm"
                  title="退出流式播放"
                >
                  <span>退出</span>
                </button>
              )}
            </div>
          </div>

          <div className="text-center text-xs text-gray-500/70 dark:text-gray-400/50">
            流式播放中 · 实时生成
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-gradient-to-br from-gray-900/[0.03] to-gray-900/[0.06] dark:from-white/[0.04] dark:to-white/[0.02] rounded-2xl p-6 border border-white/20 dark:border-white/[0.06] shadow-lg shadow-black/[0.04] dark:shadow-black/20">
      <audio ref={audioRef} src={url ?? undefined} preload="auto" />

      <div className="space-y-4">
        <div className="relative">
          <WaveformVisualizer
            audioUrl={url ?? ""}
            duration={duration}
            onSeek={handleSeek}
          />
          <div
            ref={playheadRef}
            className="absolute top-0 h-full w-[2px] bg-gradient-to-b from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white pointer-events-none will-change-[left] rounded-full shadow-sm shadow-gray-900/30"
            style={{ left: 0, transform: "translateX(-0.5px)" }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span ref={timeRef}>0:00</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={skipBackward}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              title="后退5秒"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white text-white rounded-full flex items-center justify-center hover:brightness-110 transition-all duration-200 shadow-lg shadow-gray-900/30 shadow-gray-100/20"
            >
              {showPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={skipForward}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              title="前进5秒"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-200 dark:bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-gray-700 dark:accent-white"
              />
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center space-x-1 px-3 py-2 backdrop-blur-lg bg-gray-500/10 dark:bg-white/[0.08] border border-gray-300/20 dark:border-gray-400/10 text-gray-700 dark:text-white rounded-xl hover:bg-gray-500/15 dark:hover:bg-white/12 transition-all duration-200"
              title="下载音频"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">下载</span>
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 dark:text-gray-500">
          生成完成 · 时长 {formatTime(duration)} · WAV 格式
        </div>
      </div>
    </div>
  );
}
