import { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon,
  RefreshCw,
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
import { GlassCard, GlassButton } from "./ui";

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
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-slate-600 dark:from-gray-400 dark:to-slate-400 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-4 h-4 text-white" />
          </div>
          <span>设置</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 ml-10">系统状态和配置</p>
      </div>

      {/* System Status */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">系统状态</h3>
          <button
            onClick={() => {
              onRefresh();
              fetchModels();
            }}
            className="flex items-center space-x-1 text-sm text-gray-600 dark:text-white hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>刷新</span>
          </button>
        </div>

        {health ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] rounded-xl border border-white/15 dark:border-white/[0.05]">
              <span className="text-gray-600 dark:text-gray-400 text-sm">服务器状态</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">正常</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] rounded-xl border border-white/15 dark:border-white/[0.05]">
              <span className="text-gray-600 dark:text-gray-400 text-sm">模型状态</span>
              <div className="flex items-center space-x-2">
                {health.model_loaded ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      已加载 {health.current_model ? `(${MODEL_LABELS[health.current_model] || health.current_model})` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                    <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">未加载</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] rounded-xl border border-white/15 dark:border-white/[0.05]">
              <span className="text-gray-600 dark:text-gray-400 text-sm">生成模式</span>
              <div className="flex items-center space-x-2">
                {streamingMode === "streaming" ? (
                  <Zap className="w-4 h-4 text-gray-600 dark:text-white" />
                ) : (
                  <Cpu className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
                <span className="text-gray-700 dark:text-gray-300 text-sm">{streamingMode === "streaming" ? "流式" : "非流式"}</span>
              </div>
            </div>

            {health.error && (
              <GlassCard variant="subtle" className="p-3 border-red-300/30 dark:border-red-500/15">
                <p className="text-red-500 dark:text-red-400 text-sm">{health.error}</p>
              </GlassCard>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">无法获取状态</div>
        )}
      </GlassCard>

      {/* Generation Settings */}
      <GlassCard className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">生成设置</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] rounded-xl border border-white/15 dark:border-white/[0.05]">
            <div>
              <span className="text-gray-700 dark:text-gray-200 font-medium text-sm">流式生成</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">开启后音频将边生成边传输</p>
            </div>
            <button
              onClick={handleStreamingToggle}
              disabled={actionLoading === "mode"}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
                streamingMode === "streaming"
                  ? "bg-gradient-to-r from-gray-700 to-gray-900 shadow-sm shadow-gray-900/30"
                  : "bg-gray-300/60 dark:bg-white/[0.1]"
              } ${actionLoading === "mode" ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  streamingMode === "streaming" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="p-3 backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] rounded-xl border border-white/15 dark:border-white/[0.05] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200 font-medium text-sm">Chunk Size</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 backdrop-blur-lg bg-white/40 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">{chunkSize}</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={chunkSize}
              onChange={(e) => handleChunkSizeChange(parseInt(e.target.value))}
              disabled={actionLoading === "chunk"}
              className="w-full h-1.5 bg-gray-200 dark:bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-gray-700 dark:accent-white"
            />
            <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500">
              <span>1 (低延迟)</span>
              <span>24 (高质量)</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Model Management */}
      <GlassCard className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
          <HardDrive className="w-5 h-5 text-gray-600 dark:text-white" />
          <span>模型管理</span>
        </h3>

        {models ? (
          <div className="space-y-3">
            <div className="p-3 backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] rounded-xl border border-white/15 dark:border-white/[0.05]">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                当前模型: {models.current ? (
                  <span className="font-medium text-gray-900 dark:text-white">{MODEL_LABELS[models.current] || models.current}</span>
                ) : (
                  <span className="text-amber-500 dark:text-amber-400">无</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.entries(models.models).map(([key]) => (
                <button
                  key={key}
                  onClick={() => handleLoadModel(key)}
                  disabled={actionLoading === `load-${key}` || models.current === key}
                  className={`flex items-center justify-center space-x-1 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    models.current === key
                      ? "bg-gradient-to-r from-gray-900/15 to-gray-900/15 dark:from-white/10 dark:to-white/10 text-gray-900 dark:text-gray-100 border border-gray-300/30 dark:border-gray-400/15 shadow-sm"
                      : "backdrop-blur-lg bg-white/40 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 border border-white/25 dark:border-white/[0.08] hover:bg-white/60 dark:hover:bg-white/[0.06] hover:border-gray-300/30 dark:hover:border-gray-400/15"
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

            <GlassButton
              onClick={handleUnloadModel}
              disabled={actionLoading === "unload" || !models.loaded}
              variant="danger"
              size="md"
              className="w-full"
            >
              {actionLoading === "unload" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>卸载当前模型</span>
            </GlassButton>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">无法获取模型信息</div>
        )}
      </GlassCard>

      {/* Action Message */}
      {actionMessage && (
        <GlassCard variant="subtle" className="p-3 border-gray-300/30 dark:border-gray-400/15">
          <p className="text-gray-700 dark:text-white text-sm">{actionMessage}</p>
        </GlassCard>
      )}

      {/* About */}
      <GlassCard variant="subtle" className="p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">关于</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p><strong className="text-gray-800 dark:text-gray-200">QianYU TTS</strong> - 基于 Qwen3-TTS 的文本转语音桌面应用</p>
          <p>版本：1.0.0</p>
          <p>功能：声音设计、语音克隆、自定义音色</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            本工具基于阿里巴巴通义实验室 Qwen 团队研发的 Qwen3-TTS 模型
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
