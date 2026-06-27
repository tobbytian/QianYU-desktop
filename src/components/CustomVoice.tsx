import { useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { generateCustomVoiceStreaming } from "@/services/api";
import { AudioPlayer } from "./AudioPlayer";
import { GlassCard, GlassButton, GlassInput, GlassTextarea } from "./ui";
import { Loader2, Volume2, User } from "lucide-react";

const LANGUAGES = [
  "Auto", "Chinese", "English", "Japanese", "Korean",
  "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
];

const SPEAKERS = [
  { id: "Vivian", name: "Vivian", description: "明亮微锐的年轻女声" },
  { id: "Serena", name: "Serena", description: "温暖柔和的年轻女声" },
  { id: "Uncle_Fu", name: "Uncle Fu", description: "低沉浑厚的成熟男声" },
  { id: "Dylan", name: "Dylan", description: "清脆自然的北京男声" },
  { id: "Eric", name: "Eric", description: "微沙明亮的成都男声" },
  { id: "Ryan", name: "Ryan", description: "节奏感强的活力男声" },
  { id: "Aiden", name: "Aiden", description: "清亮中频的阳光美式男声" },
  { id: "Ono_Anna", name: "Ono Anna", description: "轻盈灵动的日系女声" },
  { id: "Sohee", name: "Sohee", description: "情感丰富的韩系女声" },
];

const STYLE_EXAMPLES = [
  "用愤怒的语气", "开心地", "悲伤地", "平静地", "激动地", "温柔地",
];

export function CustomVoice() {
  const [text, setText] = useState("欢迎使用自定义音色功能，你可以选择预设说话人，并添加情绪或风格指令来体验不同的表达效果。");
  const [language, setLanguage] = useState("Auto");
  const [speaker, setSpeaker] = useState("Vivian");
  const [instruct, setInstruct] = useState("");

  const { loading, error, audioUrl, duration, streamingProgress, streamingPlayback, generateStreaming, stopGeneration, cleanup } = useTTS();

  const handleGenerate = async () => {
    if (!text.trim()) return;
    await generateStreaming(() => generateCustomVoiceStreaming(text.trim(), language, speaker, instruct));
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 rounded-lg flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-white" />
          </div>
          <span>自定义音色</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 ml-10">使用官方预设的高质量说话人，支持情感控制</p>
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
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 rounded-xl backdrop-blur-lg bg-white/50 dark:bg-white/[0.06] border border-white/30 dark:border-white/[0.1] text-gray-900 dark:text-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/40 dark:focus:ring-gray-400/30 appearance-none cursor-pointer [&_option]:bg-white [&_option]:text-gray-900"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {/* Speaker Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择说话人</label>
          <div className="grid grid-cols-3 gap-2">
            {SPEAKERS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSpeaker(s.id)}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 ${
                  speaker === s.id
                    ? "bg-gradient-to-b from-emerald-500/10 to-teal-500/10 dark:from-emerald-400/[0.08] dark:to-teal-400/[0.08] border-emerald-400/40 dark:border-emerald-400/20 shadow-sm"
                    : "backdrop-blur-lg bg-white/30 dark:bg-white/[0.03] border-white/20 dark:border-white/[0.06] hover:bg-white/50 dark:hover:bg-white/[0.06] hover:border-white/30 dark:hover:border-white/[0.1]"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all duration-200 ${
                  speaker === s.id
                    ? "bg-gradient-to-br from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 shadow-lg shadow-emerald-500/20"
                    : "bg-white/40 dark:bg-white/[0.06]"
                }`}>
                  <User className={`w-5 h-5 ${speaker === s.id ? "text-white" : "text-gray-500 dark:text-gray-400"}`} />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 text-center leading-tight">{s.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Style Instruct */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">风格指令（可选）</label>
          <GlassInput
            type="text"
            value={instruct}
            onChange={(e) => setInstruct(e.target.value)}
            placeholder="例如：用愤怒的语气、开心地、悲伤地"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {STYLE_EXAMPLES.map((style) => (
              <button
                key={style}
                onClick={() => setInstruct(style)}
                className="px-3 py-1.5 text-xs backdrop-blur-lg bg-white/40 dark:bg-white/[0.06] border border-white/25 dark:border-white/[0.08] text-gray-600 dark:text-gray-300 rounded-full hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300/30 dark:hover:border-emerald-400/20 transition-all duration-200"
              >
                {style}
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
            <Volume2 className="w-5 h-5" />
            <span>开始合成</span>
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
