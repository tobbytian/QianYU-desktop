import { useState, useEffect } from "react";
import { VoiceDesign } from "./components/VoiceDesign";
import { VoiceClone } from "./components/VoiceClone";
import { CustomVoice } from "./components/CustomVoice";
import { VoiceManager } from "./components/VoiceManager";
import { Settings } from "./components/Settings";
import { healthCheck, type HealthResponse } from "./services/api";
import {
  Mic,
  Copy,
  Settings as SettingsIcon,
  Volume2,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

type Tab = "voice-design" | "voice-clone" | "custom-voice" | "voice-manager" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("voice-design");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
    // 每30秒检查一次状态
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const result = await healthCheck();
      setHealth(result);
      setError(null);
    } catch (err) {
      setError("无法连接到TTS服务器，请确保服务器已启动");
      console.error("Health check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      id: "voice-design" as Tab,
      label: "声音设计",
      icon: Mic,
      description: "通过描述创建定制化音色",
    },
    {
      id: "voice-clone" as Tab,
      label: "语音克隆",
      icon: Copy,
      description: "基于参考音频复刻声音",
    },
    {
      id: "custom-voice" as Tab,
      label: "自定义音色",
      icon: Volume2,
      description: "使用预设高质量说话人",
    },
    {
      id: "voice-manager" as Tab,
      label: "音色管理",
      icon: Users,
      description: "管理已保存的音色",
    },
    {
      id: "settings" as Tab,
      label: "设置",
      icon: SettingsIcon,
      description: "系统状态和配置",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
              <Volume2 className="w-12 h-12 text-primary-600" />
            </div>
            <Loader2 className="w-8 h-8 text-primary-600 absolute -bottom-2 left-1/2 transform -translate-x-1/2 animate-spin" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">QianYU TTS</h1>
            <p className="text-gray-600">正在连接服务器...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="text-center space-y-6 max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Volume2 className="w-12 h-12 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">连接失败</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-gray-600 mb-4 text-sm">
              请确保已运行 <code className="bg-gray-100 px-2 py-1 rounded">dev.bat</code> 启动服务器
            </p>
            <button
              onClick={() => {
                setLoading(true);
                checkHealth();
              }}
              className="flex items-center space-x-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重试</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Volume2 className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">QianYU TTS</h1>
                <p className="text-xs text-gray-500">文本转语音工具</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${health?.model_loaded ? "bg-green-500" : "bg-yellow-500"}`} />
                <span className="text-sm text-gray-600">
                  {health?.model_loaded ? "模型已加载" : "模型未加载"}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                模式: {health?.mode || "unknown"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <nav className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border p-4 sticky top-8">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                        isActive
                          ? "bg-primary-50 text-primary-700 border border-primary-200"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? "text-primary-600" : "text-gray-400"}`} />
                      <div className="text-left">
                        <div className="font-medium">{tab.label}</div>
                        <div className="text-xs text-gray-500">{tab.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              {activeTab === "voice-design" && <VoiceDesign />}
              {activeTab === "voice-clone" && <VoiceClone />}
              {activeTab === "custom-voice" && <CustomVoice />}
              {activeTab === "voice-manager" && <VoiceManager />}
              {activeTab === "settings" && <Settings health={health} onRefresh={checkHealth} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
