import { useState, useRef } from "react";
import { useTTS } from "@/hooks/useTTS";
import { AudioPlayer } from "./AudioPlayer";
import { Loader2, Copy, Upload } from "lucide-react";

const LANGUAGES = [
  "Auto", "Chinese", "English", "Japanese", "Korean",
  "German", "French", "Russian", "Portuguese", "Spanish", "Italian",
];

export function VoiceClone() {
  const [text, setText] = useState("你好，很高兴见到你。");
  const [language, setLanguage] = useState("Auto");
  const [refAudioPath, setRefAudioPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loading, error, audioUrl, audioData, sampleRate, duration, generate, cleanup } = useTTS();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 在实际应用中，需要将文件路径传递给后端
      // 这里假设文件已经在服务器可访问的路径
      setRefAudioPath(file.name);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    await generate({
      text: text.trim(),
      language,
      ref_audio_path: refAudioPath || undefined,
    });
  };

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">参考音频</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {refAudioPath ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-2 text-primary-600">
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">{refAudioPath}</span>
                </div>
                <button
                  onClick={() => setRefAudioPath(null)}
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
              <Copy className="w-5 h-5" />
              <span>开始克隆</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {audioUrl && (
        <AudioPlayer
          url={audioUrl}
          duration={duration}
          audioData={audioData || undefined}
          sampleRate={sampleRate}
          onCleanup={cleanup}
        />
      )}
    </div>
  );
}
