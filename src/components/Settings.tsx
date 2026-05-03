import { Settings as SettingsIcon, RefreshCw, CheckCircle, XCircle, Cpu, Zap } from "lucide-react";
import type { HealthResponse } from "@/services/api";

interface SettingsProps {
  health: HealthResponse | null;
  onRefresh: () => void;
}

export function Settings({ health, onRefresh }: SettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <SettingsIcon className="w-6 h-6 text-primary-600" />
          <span>设置</span>
        </h2>
        <p className="text-gray-600 mt-1">系统状态和配置</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">系统状态</h3>
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>刷新</span>
          </button>
        </div>

        {health ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-gray-600">服务器状态</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-600">正常</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-gray-600">模型状态</span>
              <div className="flex items-center space-x-2">
                {health.model_loaded ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-600">已加载</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-600">未加载</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-gray-600">生成模式</span>
              <div className="flex items-center space-x-2">
                {health.mode === "streaming" ? (
                  <Zap className="w-5 h-5 text-blue-600" />
                ) : (
                  <Cpu className="w-5 h-5 text-gray-600" />
                )}
                <span className="text-gray-700">{health.mode}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">无法获取状态</div>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">关于</h3>
        <div className="space-y-2 text-gray-600">
          <p><strong>QianYU TTS</strong> - 基于 Qwen3-TTS 的文本转语音桌面应用</p>
          <p>版本：1.0.0</p>
          <p>功能：声音设计、语音克隆、自定义音色</p>
          <p className="text-sm text-gray-500 mt-4">
            本工具基于阿里巴巴通义实验室 Qwen 团队研发的 Qwen3-TTS 模型
          </p>
        </div>
      </div>
    </div>
  );
}
