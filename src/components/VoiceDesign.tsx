import { useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { generateVoiceDesignStreaming, saveVoice } from "@/services/api";
import { AudioPlayer } from "./AudioPlayer";
import { GlassCard, GlassButton, GlassInput, GlassTextarea, GlassSelect } from "./ui";
import { Loader2, Mic, Wand2, Save } from "lucide-react";

const LANGUAGES = [
  "Auto", "Chinese", "English", "Japanese", "Korean",
  "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
];

const EXAMPLE_DESCRIPTIONS = [
  "甜美的萝莉音", "成熟磁性的男声", "温柔的女声", "活泼开朗的少女音", "沉稳的播音腔",
];

const DEFAULT_DESCRIPTION = "温柔的女声";

export function VoiceDesign() {
  const [text, setText] = useState("欢迎使用声音设计功能，你可以用自然语言描述想要的音色，让系统为这段文字生成更贴合场景的声音。");
  const [language, setLanguage] = useState("Auto");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [saveName, setSaveName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { loading, error, audioUrl, duration, streamingProgress, streamingPlayback, generateStreaming, stopGeneration, cleanup } = useTTS();

  const handleGenerate = async () => {
    if (!text.trim()) return;
    const voiceDescription = description.trim() || DEFAULT_DESCRIPTION;
    await generateStreaming(() => generateVoiceDesignStreaming(text.trim(), language, voiceDescription));
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
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white rounded-lg flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <span>声音设计</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 ml-10">
          通过自然语言描述创建定制化音色，如"甜美的萝莉音"、"成熟磁性的男声"
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">要转换的文本</label>
          <GlassTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要转换为语音的文本..."
            rows={4}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">声音描述</label>
          <GlassInput
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：甜美的萝莉音、成熟磁性的男声"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_DESCRIPTIONS.map((desc) => (
              <button
                key={desc}
                onClick={() => setDescription(desc)}
                className="px-3 py-1.5 text-xs backdrop-blur-lg bg-white/40 dark:bg-white/[0.06] border border-white/25 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-500/10 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white hover:border-gray-300/30 dark:hover:border-gray-400/20 transition-all duration-200"
              >
                {desc}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <GlassButton onClick={stopGeneration} variant="danger" size="lg" className="w-full">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>停止生成</span>
          </GlassButton>
        ) : (
          <GlassButton onClick={handleGenerate} disabled={!text.trim()} size="lg" className="w-full">
            <Mic className="w-5 h-5" />
            <span>开始生成</span>
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

      {/* Save Section */}
      {audioUrl && (
        <GlassCard variant="subtle" className="p-5 space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
            <Save className="w-4 h-4" />
            <span>保存此音色以便复用</span>
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">保存后可在"语音克隆"标签页中直接使用此音色</p>
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
              <span>保存</span>
            </GlassButton>
          </div>
          {saveMessage && (
            <p className={`text-sm ${saveMessage.includes("成功") ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {saveMessage}
            </p>
          )}
        </GlassCard>
      )}
    </div>
  );
}
