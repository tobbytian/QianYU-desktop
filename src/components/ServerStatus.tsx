import { Cpu, Zap } from "lucide-react";

interface ServerStatusProps {
  ready: boolean;
  cudaAvailable: boolean;
}

export function ServerStatus({ ready, cudaAvailable }: ServerStatusProps) {
  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2 px-3 py-1.5 backdrop-blur-lg bg-white/30 dark:bg-white/[0.05] border border-white/20 dark:border-white/[0.08] rounded-full">
        {cudaAvailable ? (
          <Zap className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
        ) : (
          <Cpu className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {cudaAvailable ? "CUDA 加速" : "CPU 模式"}
        </span>
      </div>

      <div className="flex items-center space-x-2">
        {ready ? (
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
        )}
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {ready ? "引擎就绪" : "引擎未就绪"}
        </span>
      </div>
    </div>
  );
}
