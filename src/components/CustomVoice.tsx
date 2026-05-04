import { useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { generateCustomVoiceStreaming } from "@/services/api";
import { AudioPlayer } from "./AudioPlayer";
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
  const [text, setText] = useState("其实我真的有发现，我是一个特别善于观察别人情绪的人。");
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <Volume2 className="w-6 h-6 text-primary-600" />
          <span>自定义音色</span>
        </h2>
        <p className="text-gray-600 mt-1">使用官方预设的高质量说话人，支持情感控制</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">选择说话人</label>
          <div className="grid grid-cols-3 gap-2">
            {SPEAKERS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSpeaker(s.id)}
                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                  speaker === s.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                  speaker === s.id ? "bg-primary-100" : "bg-gray-100"
                }`}>
                  <User className={`w-5 h-5 ${speaker === s.id ? "text-primary-600" : "text-gray-500"}`} />
                </div>
                <span className="text-sm font-medium text-gray-900">{s.name}</span>
                <span className="text-xs text-gray-500">{s.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">风格指令（可选）</label>
          <input
            type="text"
            value={instruct}
            onChange={(e) => setInstruct(e.target.value)}
            placeholder="例如：用愤怒的语气、开心地、悲伤地"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {STYLE_EXAMPLES.map((style) => (
              <button
                key={style}
                onClick={() => setInstruct(style)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-primary-100 hover:text-primary-700 transition-colors"
              >
                {style}
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
            <Volume2 className="w-5 h-5" />
            <span>开始合成</span>
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
    </div>
  );
}
