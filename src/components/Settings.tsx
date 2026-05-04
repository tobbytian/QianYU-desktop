import { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon,
  RefreshCw,
  CheckCircle,
  XCircle,
  Cpu,
  Zap,
  Loader2,
  HardDrive,
  Trash2,
} from "lucide-react";
import type { HealthResponse } from "@/services/api";
import {
  setStreamingMode as apiSetStreamingMode,
  setChunkSize as apiSetChunkSize,
  getModels,
  loadModel as apiLoadModel,
  unloadModel as apiUnloadModel,
  type ModelsResponse,
} from "@/services/api";

interface SettingsProps {
  health: HealthResponse | null;
  onRefresh: () => void;
}

export function Settings({ health, onRefresh }: SettingsProps) {
  const [streamingMode, setStreamingMode] = useState<"streaming" | "non-streaming">("streaming");
  const [chunkSize, setChunkSizeState] = useState(8);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      const data = await getModels();
      setModels(data);
    } catch {
      // ignore - server may not support this endpoint yet
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (health?.mode) {
      setStreamingMode(health.mode === "streaming" ? "streaming" : "non-streaming");
    }
  }, [health?.mode]);

  const handleStreamingToggle = async () => {
    const newMode = streamingMode === "streaming" ? "non-streaming" : "streaming";
    setActionLoading("mode");
    setActionMessage(null);
    try {
      await apiSetStreamingMode(newMode);
      setStreamingMode(newMode);
      setActionMessage(`已切换为 ${newMode === "streaming" ? "流式" : "非流式"} 模式`);
    } catch (err) {
      setActionMessage(`切换失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleChunkSizeChange = async (size: number) => {
    setChunkSizeState(size);
    setActionLoading("chunk");
    try {
      await apiSetChunkSize(size);
      setActionMessage(`Chunk Size 已设置为 ${size}`);
    } catch (err) {
      setActionMessage(`设置失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLoadModel = async (mode: string) => {
    setActionLoading(`load-${mode}`);
    setActionMessage(null);
    try {
      await apiLoadModel(mode);
      setActionMessage(`模型 "${mode}" 加载成功`);
      await fetchModels();
      onRefresh();
    } catch (err) {
      setActionMessage(`加载失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnloadModel = async () => {
    setActionLoading("unload");
    setActionMessage(null);
    try {
      await apiUnloadModel();
      setActionMessage("模型已卸载");
      await fetchModels();
      onRefresh();
    } catch (err) {
      setActionMessage(`卸载失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const MODEL_LABELS: Record<string, string> = {
    voice_design: "声音设计",
    voice_clone: "语音克隆",
    custom_voice: "自定义音色",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <SettingsIcon className="w-6 h-6 text-primary-600" />
          <span>设置</span>
        </h2>
        <p className="text-gray-600 mt-1">系统状态和配置</p>
      </div>

      {/* 系统状态 */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">系统状态</h3>
          <button
            onClick={() => {
              onRefresh();
              fetchModels();
            }}
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
                    <span className="text-green-600">
                      已加载 {health.current_model ? `(${MODEL_LABELS[health.current_model] || health.current_model})` : ""}
                    </span>
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
                {streamingMode === "streaming" ? (
                  <Zap className="w-5 h-5 text-blue-600" />
                ) : (
                  <Cpu className="w-5 h-5 text-gray-600" />
                )}
                <span className="text-gray-700">{streamingMode === "streaming" ? "流式" : "非流式"}</span>
              </div>
            </div>

            {health.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{health.error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">无法获取状态</div>
        )}
      </div>

      {/* 生成设置 */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">生成设置</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg">
            <div>
              <span className="text-gray-700 font-medium">流式生成</span>
              <p className="text-sm text-gray-500">开启后音频将边生成边传输</p>
            </div>
            <button
              onClick={handleStreamingToggle}
              disabled={actionLoading === "mode"}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                streamingMode === "streaming" ? "bg-primary-600" : "bg-gray-300"
              } ${actionLoading === "mode" ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  streamingMode === "streaming" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="p-3 bg-white rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">Chunk Size</span>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{chunkSize}</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={chunkSize}
              onChange={(e) => handleChunkSizeChange(parseInt(e.target.value))}
              disabled={actionLoading === "chunk"}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>1 (低延迟)</span>
              <span>24 (高质量)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 模型管理 */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <HardDrive className="w-5 h-5 text-primary-600" />
          <span>模型管理</span>
        </h3>

        {models ? (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-lg">
              <div className="text-sm text-gray-600 mb-2">
                当前模型: {models.current ? (
                  <span className="font-medium text-gray-900">{MODEL_LABELS[models.current] || models.current}</span>
                ) : (
                  <span className="text-yellow-600">无</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.entries(models.models).map(([key]) => (
                <button
                  key={key}
                  onClick={() => handleLoadModel(key)}
                  disabled={actionLoading === `load-${key}` || models.current === key}
                  className={`flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-sm transition-all ${
                    models.current === key
                      ? "bg-primary-100 text-primary-700 border border-primary-300"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-primary-400 hover:text-primary-600"
                  } ${actionLoading === `load-${key}` ? "opacity-50" : ""}`}
                >
                  {actionLoading === `load-${key}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{MODEL_LABELS[key] || key}</span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleUnloadModel}
              disabled={actionLoading === "unload" || !models.loaded}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {actionLoading === "unload" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>卸载当前模型</span>
            </button>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">无法获取模型信息</div>
        )}
      </div>

      {/* 操作消息 */}
      {actionMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700 text-sm">{actionMessage}</p>
        </div>
      )}

      {/* 关于 */}
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
