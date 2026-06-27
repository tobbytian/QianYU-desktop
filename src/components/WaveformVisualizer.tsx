import { useRef, useEffect, useCallback, useState } from "react";

interface WaveformVisualizerProps {
  audioUrl: string;
  duration: number;
  onSeek: (time: number) => void;
}

const CANVAS_HEIGHT = 64;
const BAR_COUNT = 200;

export function WaveformVisualizer({
  audioUrl,
  duration,
  onSeek,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawnRef = useRef(false);
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    if (!audioUrl) return;

    drawnRef.current = false;
    setBars([]);

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    fetch(audioUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((ab) => {
        const data = ab.getChannelData(0);
        const blockSize = Math.floor(data.length / BAR_COUNT);
        const result: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(data[i * blockSize + j]);
          }
          result.push(sum / blockSize);
        }
        const max = Math.max(...result);
        setBars(max > 0 ? result.map((v) => v / max) : result);
        ctx.close();
      })
      .catch(() => ctx.close());
  }, [audioUrl]);

  useEffect(() => {
    if (bars.length === 0 || drawnRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.offsetWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = CANVAS_HEIGHT + "px";

    const c = canvas.getContext("2d");
    if (!c) return;

    c.scale(dpr, dpr);
    c.clearRect(0, 0, width, CANVAS_HEIGHT);

    const barWidth = width / bars.length;
    const barGap = 1;

    const isDark = document.documentElement.classList.contains("dark");

    bars.forEach((value, i) => {
      const x = i * barWidth;
      const h = Math.max(2, value * CANVAS_HEIGHT * 0.8);
      const y = (CANVAS_HEIGHT - h) / 2;

      const gradient = c.createLinearGradient(x, y, x, y + h);
      if (isDark) {
        gradient.addColorStop(0, "rgba(180, 180, 180, 0.9)");
        gradient.addColorStop(0.5, "rgba(200, 200, 200, 0.95)");
        gradient.addColorStop(1, "rgba(220, 220, 220, 0.9)");
      } else {
        gradient.addColorStop(0, "rgba(80, 80, 80, 0.85)");
        gradient.addColorStop(0.5, "rgba(100, 100, 100, 0.9)");
        gradient.addColorStop(1, "rgba(120, 120, 120, 0.85)");
      }

      c.fillStyle = gradient;
      c.beginPath();
      c.roundRect(x + barGap / 2, y, barWidth - barGap, h, 1);
      c.fill();
    });

    drawnRef.current = true;
  }, [bars]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || duration <= 0) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      onSeek(Math.max(0, Math.min(duration, ratio * duration)));
    },
    [duration, onSeek]
  );

  if (bars.length === 0) {
    return (
      <div className="h-16 backdrop-blur-lg bg-white/40 dark:bg-white/[0.04] rounded-xl flex items-center justify-center overflow-hidden">
        <div className="flex items-center space-x-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-gray-400/40 dark:bg-gray-400/20 rounded-full animate-pulse"
              style={{
                height: `${12 + Math.sin(i * 1.2) * 8}px`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl backdrop-blur-lg bg-white/15 dark:bg-white/[0.03] overflow-hidden cursor-pointer border border-white/10 dark:border-white/[0.04]"
      style={{ height: CANVAS_HEIGHT }}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
