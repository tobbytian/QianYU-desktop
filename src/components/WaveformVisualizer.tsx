import { useRef, useEffect, useCallback, useState } from "react";

interface WaveformVisualizerProps {
  audioUrl: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function WaveformVisualizer({
  audioUrl,
  currentTime,
  duration,
  onSeek,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Extract waveform data from audio
  useEffect(() => {
    if (!audioUrl) return;

    setIsLoading(true);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    fetch(audioUrl)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        const channelData = audioBuffer.getChannelData(0);
        const samples = 200; // Number of bars in waveform
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          waveform.push(sum / blockSize);
        }

        // Normalize
        const max = Math.max(...waveform);
        if (max > 0) {
          setWaveformData(waveform.map((v) => v / max));
        } else {
          setWaveformData(waveform);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to decode audio:", err);
        setIsLoading(false);
      });

    return () => {
      audioContext.close();
    };
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / waveformData.length;
    const barGap = 1;
    const progressRatio = duration > 0 ? currentTime / duration : 0;

    waveformData.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = Math.max(2, value * height * 0.8);
      const y = (height - barHeight) / 2;

      // Determine color based on progress
      const isPlayed = index / waveformData.length < progressRatio;

      if (isPlayed) {
        ctx.fillStyle = "#1d4ed8"; // played - dark blue
      } else {
        ctx.fillStyle = "#93c5fd"; // unplayed - light blue
      }

      // Draw bar
      ctx.fillRect(x + barGap / 2, y, barWidth - barGap, barHeight);
    });
  }, [waveformData, currentTime, duration]);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const time = ratio * duration;

      onSeek(Math.max(0, Math.min(duration, time)));
    },
    [duration, onSeek]
  );

  if (isLoading) {
    return (
      <div className="h-16 bg-gray-100 rounded-lg flex items-center justify-center">
        <span className="text-sm text-gray-500">Loading waveform...</span>
      </div>
    );
  }

  if (waveformData.length === 0) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 cursor-pointer rounded-lg bg-gray-50"
      style={{ width: "100%", height: "64px" }}
      onClick={handleClick}
      title="Click to seek"
    />
  );
}
