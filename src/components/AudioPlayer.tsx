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
} from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";

interface AudioPlayerProps {
  url: string | null;
  duration: number;
  onCleanup?: () => void;
}

export function AudioPlayer({ url, duration, onCleanup }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    return () => {
      onCleanup?.();
    };
  }, [onCleanup]);

  useEffect(() => {
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
    if (playheadRef.current) playheadRef.current.style.left = "0%";
    if (timeRef.current) timeRef.current.textContent = "0:00";
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const formatTime = (t: number) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    };

    let currentPct = 0;

    const tick = () => {
      const t = audio.currentTime;
      const targetPct = duration > 0 ? (t / duration) * 100 : 0;
      currentPct += (targetPct - currentPct) * 0.3;

      if (playheadRef.current) {
        playheadRef.current.style.left = `${currentPct}%`;
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
  }, [url, duration]);

  const togglePlay = () => {
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
    const audio = audioRef.current;
    if (!audio) return;
    const vol = parseFloat(e.target.value);
    audio.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
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
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
  };

  const skipForward = () => {
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

  if (!url) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-dashed border-gray-300">
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Music className="w-12 h-12 mb-3" />
          <p className="text-sm">等待生成音频...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border">
      <audio ref={audioRef} src={url} preload="auto" />

      <div className="space-y-4">
        <div className="relative">
          <WaveformVisualizer
            audioUrl={url}
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
              {isPlaying ? (
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
