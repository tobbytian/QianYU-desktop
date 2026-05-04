import { useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { generateVoiceDesignStreaming, saveVoice } from "@/services/api";
import { AudioPlayer } from "./AudioPlayer";
import { Loader2, Mic, Wand2, Save } from "lucide-react";

const LANGUAGES = [
  "Auto", "Chinese", "English", "Japanese", "Korean",
  "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
];

const EXAMPLE_DESCRIPTIONS = [
  "甜美的萝莉音", "成熟磁性的男声", "温柔的女声", "活泼开朗的少女音", "沉稳的播音腔",
];

export function VoiceDesign() {
  const [text, setText] = useState("哥哥，你回来啦，人家等了你好久好久了，要抱抱！");
  const [language, setLanguage] = useState("Auto");
  const [description, setDescription] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { loading, error, audioUrl, duration, streamingProgress, streamingPlayback, generateStreaming, stopGeneration, cleanup } = useTTS();

  const handleGenerate = async () => {
    if (!text.trim()) return;
    await generateStreaming(() => generateVoiceDesignStreaming(text.trim(), language, description));
  };

  const handleSaveVoice = async () => {
    if (!audioUrl || !saveName.trim()) return;

    setSaveLoading(true);
    setSaveMessage(null);
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const file = new File([blob], "voice_design.wav", { type: "audio/wav" });
      const result = await saveVoice(saveName.trim(), file, text.trim());
      setSaveMessage(`音色保存成功！ID: ${result.voice_id}`);
      setSaveName("");
    } catch (err) {
      setSaveMessage(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <Wand2 className="w-6 h-6 text-primary-600" />
          <span>声音设计</span>
        </h2>
        <p className="text-gray-600 mt-1">
          通过自然语言描述创建定制化音色，如"甜美的萝莉音"、"成熟磁性的男声"
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">要转换的文本</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要转换为语音的文本..."
            rows={4}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">声音描述</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：甜美的萝莉音、成熟磁性的男声"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLE_DESCRIPTIONS.map((desc) => (
              <button
                key={desc}
                onClick={() => setDescription(desc)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-primary-100 hover:text-primary-700 transition-colors"
              >
                {desc}
              </button>
            ))}
          </div>
        </div>

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
            disabled={!text.trim()}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Mic className="w-5 h-5" />
            <span>开始生成</span>
          </button>
        )}
      </div>

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

      {audioUrl && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <Save className="w-4 h-4" />
            <span>保存此音色以便复用</span>
          </h4>
          <p className="text-xs text-gray-500">保存后可在"语音克隆"标签页中直接使用此音色</p>
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
    </div>
  );
}
