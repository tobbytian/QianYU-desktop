import { Cpu, Zap, CheckCircle, XCircle } from "lucide-react";

interface ServerStatusProps {
  ready: boolean;
  cudaAvailable: boolean;
}

export function ServerStatus({ ready, cudaAvailable }: ServerStatusProps) {
  return (
    <div className="flex items-center space-x-4">
      {/* CUDA Status */}
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-full">
        {cudaAvailable ? (
          <Zap className="w-4 h-4 text-green-600" />
        ) : (
          <Cpu className="w-4 h-4 text-gray-600" />
        )}
        <span className="text-sm font-medium text-gray-700">
          {cudaAvailable ? "CUDA 加速" : "CPU 模式"}
        </span>
      </div>

      {/* Server Status */}
      <div className="flex items-center space-x-2">
        {ready ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600" />
        )}
        <span className="text-sm text-gray-600">
          {ready ? "引擎就绪" : "引擎未就绪"}
        </span>
      </div>
    </div>
  );
}
