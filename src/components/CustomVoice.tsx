import { useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { generateCustomVoice } from "@/services/api";
import { AudioPlayer } from "./AudioPlayer";
import { Loader2, Volume2, User } from "lucide-react";

const LANGUAGES = [
  "Auto", "Chinese", "English", "Japanese", "Korean",
  "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
];

const SPEAKERS = [
  { id: "Vivian", name: "Vivian", description: "温柔女声" },
  { id: "Serena", name: "Serena", description: "优雅女声" },
  { id: "Uncle_Fu", name: "Uncle Fu", description: "沉稳男声" },
  { id: "Dylan", name: "Dylan", description: "活力男声" },
  { id: "Eric", name: "Eric", description: "磁性男声" },
  { id: "Ryan", name: "Ryan", description: "阳光男声" },
  { id: "Aiden", name: "Aiden", description: "少年音" },
  { id: "Ono_Anna", name: "Ono Anna", description: "日系女声" },
  { id: "Sohee", name: "Sohee", description: "韩系女声" },
];

const STYLE_EXAMPLES = [
  "用愤怒的语气", "开心地", "悲伤地", "平静地", "激动地", "温柔地",
];

export function CustomVoice() {
  const [text, setText] = useState("其实我真的有发现，我是一个特别善于观察别人情绪的人。");
  const [language, setLanguage] = useState("Auto");
  const [speaker, setSpeaker] = useState("Vivian");
  const [instruct, setInstruct] = useState("");

  const { loading, error, audioUrl, duration, generate, cleanup } = useTTS();

  const handleGenerate = async () => {
    if (!text.trim()) return;
    await generate(() => generateCustomVoice(text.trim(), language, speaker, instruct));
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

        <button
          onClick={handleGenerate}
          disabled={loading || !text.trim()}
          className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5" />
              <span>开始合成</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <AudioPlayer
        url={audioUrl}
        duration={duration}
        onCleanup={cleanup}
      />
    </div>
  );
}
