import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  FolderOpen,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { openSaveDialog, saveAudioFile } from "@/services/api";

interface AudioPlayerProps {
  url: string;
  duration: number;
  audioData?: number[];
  sampleRate?: number;
  onCleanup?: () => void;
}

export function AudioPlayer({
  url,
  duration,
  audioData,
  sampleRate,
  onCleanup,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    return () => {
      onCleanup?.();
    };
  }, [onCleanup]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

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
    setCurrentTime(time);
  };

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    handleSeek(time);
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
    if (!audio) return;

    audio.currentTime = Math.max(0, audio.currentTime - 5);
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.min(duration, audio.currentTime + 5);
  };

  // Quick download (browser default)
  const handleQuickDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `qianyu-tts-${formatDateForFilename()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save as (system dialog)
  const handleSaveAs = async () => {
    if (!audioData || !sampleRate) {
      console.error("No audio data available");
      return;
    }

    setSaving(true);
    try {
      const defaultFilename = `qianyu-tts-${formatDateForFilename()}.wav`;
      const filePath = await openSaveDialog(defaultFilename);

      if (filePath) {
        await saveAudioFile(filePath, audioData, sampleRate);
        console.log("Audio saved to:", filePath);
      }
    } catch (err) {
      console.error("Failed to save audio:", err);
    } finally {
      setSaving(false);
    }
  };

  const formatDateForFilename = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border">
      <audio ref={audioRef} src={url} preload="auto" />

      <div className="space-y-4">
        {/* Waveform */}
        <WaveformVisualizer
          audioUrl={url}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
        />

        {/* Progress Bar */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={currentTime}
            onChange={handleSeekInput}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between text-sm text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Skip Backward */}
            <button
              onClick={skipBackward}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="后退5秒"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play/Pause */}
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

            {/* Skip Forward */}
            <button
              onClick={skipForward}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="前进5秒"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            {/* Volume */}
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

            {/* Quick Download */}
            <button
              onClick={handleQuickDownload}
              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
              title="快速下载"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Save As (System Dialog) */}
            <button
              onClick={handleSaveAs}
              disabled={saving || !audioData}
              className="flex items-center space-x-1 px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 disabled:opacity-50 transition-colors"
              title="另存为..."
            >
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm">{saving ? "保存中..." : "另存为"}</span>
            </button>
          </div>
        </div>

        {/* Audio Info */}
        <div className="text-center text-sm text-gray-500">
          生成完成 · 时长 {formatTime(duration)} · WAV 格式
        </div>
      </div>
    </div>
  );
}
