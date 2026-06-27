import { useState, useRef, useEffect, useCallback } from "react";
import { useTTS } from "@/hooks/useTTS";
import {
  generateVoiceCloneUploadStreaming,
  generateVoiceCloneSavedStreaming,
  getVoices,
  saveVoice,
  deleteVoice,
  type Voice,
} from "@/services/api";
import { AudioPlayer } from "./AudioPlayer";
import { GlassCard, GlassButton, GlassInput, GlassTextarea, GlassSelect } from "./ui";
import { Loader2, Copy, Upload, Save, Trash2, ChevronDown } from "lucide-react";

const LANGUAGES = [
  "Auto", "Chinese", "English", "Japanese", "Korean",
  "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
];

export function VoiceClone() {
  const [text, setText] = useState("欢迎使用语音克隆功能，上传一段参考音频后，我会尝试用相似的声音朗读这段介绍内容。");
  const [language, setLanguage] = useState("Auto");
  const [refAudioFile, setRefAudioFile] = useState<File | null>(null);
  const [refText, setRefText] = useState("");
  const [savedVoices, setSavedVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [saveName, setSaveName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSaveSection, setShowSaveSection] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loading, error, audioUrl, duration, streamingProgress, streamingPlayback, generateStreaming, stopGeneration, cleanup } = useTTS();

  const fetchVoices = useCallback(async () => {
    try {
      const voices = await getVoices();
      setSavedVoices(voices);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefAudioFile(file);
      setSelectedVoiceId("");
      setShowSaveSection(true);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;

    if (selectedVoiceId) {
      await generateStreaming(() =>
        generateVoiceCloneSavedStreaming(text.trim(), language, selectedVoiceId)
      );
    } else if (refAudioFile) {
      await generateStreaming(() =>
        generateVoiceCloneUploadStreaming(text.trim(), language, refAudioFile, refText)
      );
    }
  };

  const handleSaveVoice = async () => {
    if (!refAudioFile || !saveName.trim()) return;

    setSaveLoading(true);
    setSaveMessage(null);
    try {
      const result = await saveVoice(saveName.trim(), refAudioFile, refText);
      setSaveMessage(`音色保存成功！名称: ${result.name}，ID: ${result.voice_id}`);
      setSaveName("");
      await fetchVoices();
      setSelectedVoiceId(result.voice_id);
      setRefAudioFile(null);
      setShowSaveSection(false);
    } catch (err) {
      setSaveMessage(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    try {
      await deleteVoice(voiceId);
      if (selectedVoiceId === voiceId) {
        setSelectedVoiceId("");
      }
      await fetchVoices();
    } catch (err) {
      setSaveMessage(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSelectSavedVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    if (voiceId) {
      setRefAudioFile(null);
      setShowSaveSection(false);
    }
  };

  useEffect(() => {
    const handleVoicesUpdated = async (event: Event) => {
      const voiceId = (event as CustomEvent<{ voiceId?: string }>).detail?.voiceId;
      await fetchVoices();
      if (voiceId) {
        setSelectedVoiceId(voiceId);
        setRefAudioFile(null);
        setShowSaveSection(false);
      }
    };

    window.addEventListener("qianyu-voices-updated", handleVoicesUpdated);
    return () => window.removeEventListener("qianyu-voices-updated", handleVoicesUpdated);
  }, [fetchVoices]);

  const canGenerate = text.trim() && (refAudioFile || selectedVoiceId);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 dark:from-violet-400 dark:to-purple-400 rounded-lg flex items-center justify-center">
            <Copy className="w-4 h-4 text-white" />
          </div>
          <span>语音克隆</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 ml-10">基于参考音频复刻目标声音</p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">要转换的文本</label>
          <GlassTextarea
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            placeholder="输入要转换为语音的文本..."
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">语言</label>
          <GlassSelect value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </GlassSelect>
        </div>

        {/* Saved Voices */}
        {savedVoices.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">使用已保存音色</label>
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <GlassSelect
                  value={selectedVoiceId}
                  onChange={(e) => handleSelectSavedVoice(e.target.value)}
                  className="appearance-none pr-10"
                >
                  <option value="">-- 选择已保存音色 --</option>
                  {savedVoices.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.id})</option>
                  ))}
                </GlassSelect>
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              </div>
              {selectedVoiceId && (
                <GlassButton
                  onClick={() => handleDeleteVoice(selectedVoiceId)}
                  variant="danger"
                  size="md"
                  title="删除选中音色"
                >
                  <Trash2 className="w-4 h-4" />
                </GlassButton>
              )}
            </div>
          </div>
        )}

        {/* Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            参考音频 {selectedVoiceId && <span className="text-gray-400 dark:text-gray-500">（已选择保存音色，可跳过）</span>}
          </label>
          <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 ${
            selectedVoiceId
              ? "border-gray-200/50 dark:border-white/[0.06] bg-white/20 dark:bg-white/[0.02]"
              : "border-white/30 dark:border-white/[0.1] hover:border-gray-400/50 dark:hover:border-gray-400/30 bg-white/20 dark:bg-white/[0.02]"
          }`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {refAudioFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-2 text-gray-700 dark:text-white">
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">{refAudioFile.name}</span>
                </div>
                <button
                  onClick={() => {
                    setRefAudioFile(null);
                    setShowSaveSection(false);
                  }}
                  className="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                >
                  移除
                </button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="space-y-2">
                <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
                <p className="text-gray-600 dark:text-gray-300">点击上传参考音频</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">支持 WAV, MP3, FLAC 等格式</p>
              </button>
            )}
          </div>
        </div>

        {/* Ref Text */}
        {refAudioFile && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">参考文本（可选）</label>
            <GlassInput
              type="text"
              value={refText}
              onChange={(e) => setRefText(e.target.value)}
              placeholder="参考音频中的台词，留空则使用零样本模式"
            />
          </div>
        )}

        {/* Save Section */}
        {showSaveSection && refAudioFile && (
          <GlassCard variant="subtle" className="p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>保存音色以便复用</span>
            </h4>
            <div className="flex space-x-2">
              <GlassInput
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="给音色起个名字"
                className="text-sm py-2"
              />
              <GlassButton
                onClick={handleSaveVoice}
                disabled={saveLoading || !saveName.trim()}
                size="sm"
              >
                {saveLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="whitespace-nowrap">保存</span>
              </GlassButton>
            </div>
            {saveMessage && (
              <p className={`text-sm ${saveMessage.includes("成功") ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                {saveMessage}
              </p>
            )}
          </GlassCard>
        )}

        {/* Generate Button */}
        {loading ? (
          <GlassButton onClick={stopGeneration} variant="danger" size="lg" className="w-full">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>停止生成</span>
          </GlassButton>
        ) : (
          <GlassButton onClick={handleGenerate} disabled={!canGenerate} size="lg" className="w-full">
            <Copy className="w-5 h-5" />
            <span>{selectedVoiceId ? "使用保存音色克隆" : "开始克隆"}</span>
          </GlassButton>
        )}
      </div>

      {/* Streaming Progress */}
      {loading && streamingProgress && (
        <GlassCard variant="subtle" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-white font-medium">生成中...</span>
            <span className="text-gray-600 dark:text-white text-xs">{(streamingProgress.elapsed / 1000).toFixed(1)}s</span>
          </div>
          <div className="w-full bg-gray-200/70 dark:bg-gray-400/10 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white rounded-full animate-pulse w-full" />
          </div>
          {streamingProgress.firstChunkTime !== null && (
            <p className="text-gray-500/70 dark:text-gray-400/60 text-xs">首字延迟: {(streamingProgress.firstChunkTime / 1000).toFixed(2)}s</p>
          )}
        </GlassCard>
      )}

      {/* Error */}
      {error && (
        <GlassCard variant="subtle" className="p-4 border-red-300/30 dark:border-red-500/15">
          <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
        </GlassCard>
      )}

      {/* Audio Player */}
      <AudioPlayer
        url={audioUrl}
        duration={duration}
        onCleanup={cleanup}
        streamingPlayback={streamingPlayback}
      />
    </div>
  );
}
