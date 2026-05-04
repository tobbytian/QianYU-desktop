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
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-dashed border-gray-300">
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Music className="w-12 h-12 mb-3" />
          <p className="text-sm">等待生成音频...</p>
        </div>
      </div>
    );
  }

  if (isStreamingMode) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="font-medium">正在播放...</span>
          </div>

          <div className="flex justify-between text-sm text-gray-500">
            <span>{formatTime(currentDisplayTime)}</span>
            <span>{formatTime(currentDuration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={skipBackward}
                className="p-2 text-gray-300 cursor-not-allowed"
                disabled
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg"
              >
                {showPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>

              <button
                onClick={skipForward}
                className="p-2 text-gray-300 cursor-not-allowed"
                disabled
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
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
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              {streamingPlayback && (
                <button
                  onClick={() => streamingPlayback.stopStreaming()}
                  className="flex items-center space-x-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                  title="退出流式播放"
                >
                  <span>退出</span>
                </button>
              )}
            </div>
          </div>

          <div className="text-center text-sm text-blue-500">
            流式播放中 · 实时生成
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border">
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
            className="absolute top-0 h-full w-[2px] bg-blue-700 pointer-events-none will-change-[left]"
            style={{ left: 0, transform: "translateX(-0.5px)" }}
          />
        </div>

        <div className="flex justify-between text-sm text-gray-500">
          <span ref={timeRef}>0:00</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={skipBackward}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="后退5秒"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors shadow-lg"
            >
              {showPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={skipForward}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="前进5秒"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
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
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center space-x-1 px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
              title="下载音频"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">下载</span>
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          生成完成 · 时长 {formatTime(duration)} · WAV 格式
        </div>
      </div>
    </div>
  );
}
