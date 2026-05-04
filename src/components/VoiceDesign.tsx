import { useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { generateVoiceDesign } from "@/services/api";
import { AudioPlayer } from "./AudioPlayer";
import { Loader2, Mic, Wand2 } from "lucide-react";

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

  const { loading, error, audioUrl, duration, generate, cleanup } = useTTS();

  const handleGenerate = async () => {
    if (!text.trim()) return;
    await generate(() => generateVoiceDesign(text.trim(), language, description));
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
              <Mic className="w-5 h-5" />
              <span>开始生成</span>
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
