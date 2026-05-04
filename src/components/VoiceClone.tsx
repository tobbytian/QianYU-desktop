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
import { Loader2, Copy, Upload, Save, Trash2, ChevronDown } from "lucide-react";

const LANGUAGES = [
  "Auto", "Chinese", "English", "Japanese", "Korean",
  "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
];

export function VoiceClone() {
  const [text, setText] = useState("你好，很高兴见到你。");
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
      setSaveMessage(`音色保存成功！ID: ${result.voice_id}`);
      setSaveName("");
      await fetchVoices();
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

  const canGenerate = text.trim() && (refAudioFile || selectedVoiceId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <Copy className="w-6 h-6 text-primary-600" />
          <span>语音克隆</span>
        </h2>
        <p className="text-gray-600 mt-1">基于参考音频复刻目标声音</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">要转换的文本</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要转换为语音的文本..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">语言</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {/* 已保存音色 */}
        {savedVoices.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">使用已保存音色</label>
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <select
                  value={selectedVoiceId}
                  onChange={(e) => handleSelectSavedVoice(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none"
                >
                  <option value="">-- 选择已保存音色 --</option>
                  {savedVoices.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.id})</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              </div>
              {selectedVoiceId && (
                <button
                  onClick={() => handleDeleteVoice(selectedVoiceId)}
                  className="px-3 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  title="删除选中音色"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 参考音频上传 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            参考音频 {selectedVoiceId && <span className="text-gray-400">（已选择保存音色，可跳过）</span>}
          </label>
          <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            selectedVoiceId ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-primary-400"
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
                <div className="flex items-center justify-center space-x-2 text-primary-600">
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">{refAudioFile.name}</span>
                </div>
                <button
                  onClick={() => {
                    setRefAudioFile(null);
                    setShowSaveSection(false);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  移除
                </button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="space-y-2">
                <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-gray-600">点击上传参考音频</p>
                <p className="text-sm text-gray-500">支持 WAV, MP3, FLAC 等格式</p>
              </button>
            )}
          </div>
        </div>

        {/* 参考文本 */}
        {refAudioFile && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">参考文本（可选）</label>
            <input
              type="text"
              value={refText}
              onChange={(e) => setRefText(e.target.value)}
              placeholder="参考音频中的台词，留空则使用零样本模式"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
        )}

        {/* 保存音色 */}
        {showSaveSection && refAudioFile && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>保存音色以便复用</span>
            </h4>
            <div className="flex space-x-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="给音色起个名字"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
              />
              <button
                onClick={handleSaveVoice}
                disabled={saveLoading || !saveName.trim()}
                className="flex items-center space-x-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {saveLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>保存</span>
              </button>
            </div>
            {saveMessage && (
              <p className={`text-sm ${saveMessage.includes("成功") ? "text-green-600" : "text-red-600"}`}>
                {saveMessage}
              </p>
            )}
          </div>
        )}

        {/* 生成按钮 */}
        {loading ? (
          <button
            onClick={stopGeneration}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>停止生成</span>
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Copy className="w-5 h-5" />
            <span>{selectedVoiceId ? "使用保存音色克隆" : "开始克隆"}</span>
          </button>
        )}
      </div>

      {/* 流式进度 */}
      {loading && streamingProgress && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700 font-medium">生成中...</span>
            <span className="text-blue-600 text-xs">{(streamingProgress.elapsed / 1000).toFixed(1)}s</span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
          </div>
          {streamingProgress.firstChunkTime !== null && (
            <p className="text-blue-500 text-xs">首字延迟: {(streamingProgress.firstChunkTime / 1000).toFixed(2)}s</p>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <AudioPlayer
        url={audioUrl}
        duration={duration}
        onCleanup={cleanup}
        streamingPlayback={streamingPlayback}
      />
    </div>
  );
}
