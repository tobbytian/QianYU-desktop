import { useState, useEffect, useCallback, useRef } from "react";
import {
  getVoices,
  deleteVoice,
  renameVoice,
  batchDeleteVoices,
  exportVoices,
  importVoices,
  type Voice,
} from "@/services/api";
import { GlassCard, GlassInput } from "./ui";
import {
  Users,
  RefreshCw,
  Edit3,
  Trash2,
  Download,
  Upload,
  Check,
  X,
  CheckSquare,
  Square,
} from "lucide-react";

export function VoiceManager() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVoices = useCallback(async () => {
    try {
      const data = await getVoices();
      setVoices(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === voices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(voices.map((v) => v.id)));
    }
  };

  const handleRename = async (voiceId: string) => {
    if (!editingName.trim()) return;
    setLoading(true);
    try {
      await renameVoice(voiceId, editingName.trim());
      showMessage("success", `音色 ${voiceId} 已重命名`);
      setEditingId(null);
      await fetchVoices();
    } catch (err) {
      showMessage("error", `重命名失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingle = async (voiceId: string) => {
    setLoading(true);
    try {
      await deleteVoice(voiceId);
      showMessage("success", `已删除音色 ${voiceId}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(voiceId);
        return next;
      });
      await fetchVoices();
    } catch (err) {
      showMessage("error", `删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const result = await batchDeleteVoices(Array.from(selectedIds));
      showMessage("success", `已删除 ${result.deleted.length} 个音色`);
      setSelectedIds(new Set());
      await fetchVoices();
    } catch (err) {
      showMessage("error", `批量删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (voiceIds?: string[]) => {
    setLoading(true);
    try {
      const result = await exportVoices(voiceIds);
      if (result.voices.length === 0) {
        showMessage("error", "没有可导出的音色");
        setLoading(false);
        return;
      }

      const { invoke } = await import("@tauri-apps/api/core");

      if (result.voices.length === 1) {
        const v = result.voices[0];
        const defaultName = `qianyu-voice-${v.name}.json`;
        const filePath = await invoke<string | null>("open_save_dialog", {
          defaultFilename: defaultName,
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!filePath) {
          setLoading(false);
          return;
        }
        const content = JSON.stringify({ voices: [v] }, null, 2);
        const bytes = Array.from(new TextEncoder().encode(content));
        await invoke("save_bytes", { filePath, data: bytes });
        showMessage("success", `已导出音色: ${v.name}`);
      } else {
        const folderPath = await invoke<string | null>("open_folder_dialog");
        if (!folderPath) {
          setLoading(false);
          return;
        }
        for (const v of result.voices) {
          const fileName = `qianyu-voice-${v.name}.json`;
          const filePath = `${folderPath}\\${fileName}`;
          const content = JSON.stringify({ voices: [v] }, null, 2);
          const bytes = Array.from(new TextEncoder().encode(content));
          await invoke("save_bytes", { filePath, data: bytes });
        }
        showMessage("success", `已导出 ${result.voices.length} 个音色到文件夹`);
      }
    } catch (err) {
      showMessage("error", `导出失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await importVoices(file);
      showMessage("success", `已导入 ${result.imported.length} 个音色`);
      await fetchVoices();
    } catch (err) {
      showMessage("error", `导入失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <span>音色管理</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 ml-10">管理已保存的音色，支持重命名、批量导入导出和删除</p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm backdrop-blur-lg bg-white/40 dark:bg-white/[0.06] border border-white/25 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 rounded-xl hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all duration-200"
          >
            {selectedIds.size === voices.length && voices.length > 0 ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>全选</span>
          </button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">已选 {selectedIds.size} 个</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchVoices()}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm backdrop-blur-lg bg-white/40 dark:bg-white/[0.06] border border-white/25 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 rounded-xl hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>刷新</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,.pt"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm backdrop-blur-lg bg-gray-500/10 dark:bg-white/[0.08] border border-gray-300/30 dark:border-gray-400/15 text-gray-700 dark:text-white rounded-xl hover:bg-gray-500/15 dark:hover:bg-white/12 transition-all duration-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>导入</span>
          </button>
          <button
            onClick={() => handleExport(selectedIds.size > 0 ? Array.from(selectedIds) : undefined)}
            disabled={loading || voices.length === 0}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm backdrop-blur-lg bg-emerald-500/10 dark:bg-emerald-400/[0.08] border border-emerald-300/30 dark:border-emerald-400/15 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-500/15 dark:hover:bg-emerald-400/12 transition-all duration-200 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{selectedIds.size > 0 ? `导出选中 (${selectedIds.size})` : "导出全部"}</span>
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-2 text-sm backdrop-blur-lg bg-red-500/10 dark:bg-red-400/[0.08] border border-red-300/30 dark:border-red-400/15 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/15 dark:hover:bg-red-400/12 transition-all duration-200 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>删除选中 ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <GlassCard
          variant="subtle"
          className={`p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-300/30 dark:border-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "border-red-300/30 dark:border-red-500/15 text-red-500 dark:text-red-400"
          }`}
        >
          {message.text}
        </GlassCard>
      )}

      {/* Voice List */}
      {voices.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Users className="w-14 h-14 mx-auto mb-4 opacity-40" />
          <p className="font-medium">暂无已保存的音色</p>
          <p className="text-sm mt-1 text-gray-400/70 dark:text-gray-500/70">在声音设计或语音克隆页面保存音色后，可在此处管理</p>
        </div>
      ) : (
        <div className="space-y-2">
          {voices.map((voice) => (
            <div
              key={voice.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                selectedIds.has(voice.id)
                  ? "bg-gray-500/[0.06] dark:bg-white/[0.04] border-gray-300/30 dark:border-gray-400/15"
                  : "backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] border-white/20 dark:border-white/[0.06] hover:bg-white/50 dark:hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleSelect(voice.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${
                    selectedIds.has(voice.id)
                      ? "bg-gradient-to-br from-gray-700 to-gray-900 border-gray-700 text-white shadow-sm shadow-gray-900/20"
                      : "border-gray-300/50 dark:border-white/[0.15] hover:border-gray-400/50 dark:hover:border-gray-400/30"
                  }`}
                >
                  {selectedIds.has(voice.id) && <Check className="w-3 h-3" />}
                </button>
                <div>
                  {editingId === voice.id ? (
                    <div className="flex items-center space-x-2">
                      <GlassInput
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(voice.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="px-2 py-1 text-sm w-40"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(voice.id)}
                        disabled={loading}
                        className="p-1 text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900 dark:text-white">{voice.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{voice.id}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {voice.created_at && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">{voice.created_at}</span>
                )}
                {editingId !== voice.id && (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(voice.id);
                        setEditingName(voice.name);
                      }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors rounded-lg hover:bg-white/40 dark:hover:bg-white/[0.05]"
                      title="重命名"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExport([voice.id])}
                      disabled={loading}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors rounded-lg hover:bg-white/40 dark:hover:bg-white/[0.05]"
                      title="导出"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSingle(voice.id)}
                      disabled={loading}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-white/40 dark:hover:bg-white/[0.05]"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
