import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceDesign } from "./components/VoiceDesign";
import { VoiceClone } from "./components/VoiceClone";
import { CustomVoice } from "./components/CustomVoice";
import { VoiceManager } from "./components/VoiceManager";
import { Settings } from "./components/Settings";
import { healthCheck, type HealthResponse } from "./services/api";
import { useTheme } from "./hooks/useTheme";
import { ThemeToggle, Loader } from "./components/ui";
import {
  Mic,
  Copy,
  Settings as SettingsIcon,
  Volume2,
  RefreshCw,
  Users,
} from "lucide-react";

type Tab = "voice-design" | "voice-clone" | "custom-voice" | "voice-manager" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("voice-design");
  const [selectedTab, setSelectedTab] = useState<Tab>("voice-design");
  const [isTabFading, setIsTabFading] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const loaderStartRef = useRef(Date.now());
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingTabRef = useRef<Tab>("voice-design");
  const LOADER_MIN_MS = 2000;

  const dismissLoader = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleTabChange = useCallback((nextTab: Tab) => {
    if (nextTab === selectedTab) return;

    setSelectedTab(nextTab);
    pendingTabRef.current = nextTab;
    if (isTabFading) return;
    setIsTabFading(true);
    setTimeout(() => {
      setActiveTab(pendingTabRef.current);
      requestAnimationFrame(() => {
        setIsTabFading(false);
      });
    }, 180);
  }, [isTabFading, selectedTab]);

  useEffect(() => {
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("signal_ready");
      } catch {
        // not in Tauri context, ignore
      }
      checkHealth();
    })();
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
      const elapsed = Date.now() - loaderStartRef.current;
      const remaining = Math.max(0, LOADER_MIN_MS - elapsed);
      setTimeout(dismissLoader, remaining);
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
    return <Loader fadeOut={fadeOut} />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto p-8">
          <div className="w-24 h-24 backdrop-blur-xl bg-red-500/10 dark:bg-red-500/[0.08] border border-red-300/30 dark:border-red-500/20 rounded-3xl flex items-center justify-center mx-auto">
            <Volume2 className="w-12 h-12 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">连接失败</h1>
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
              请确保已运行 <code className="backdrop-blur-lg bg-white/40 dark:bg-white/[0.06] px-2 py-1 rounded-lg text-xs">dev.bat</code> 启动服务器
            </p>
            <button
              onClick={() => {
                setLoading(true);
                checkHealth();
              }}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl hover:brightness-110 transition-all shadow-lg shadow-red-500/25"
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
    <div className="h-screen overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 z-50 backdrop-blur-2xl bg-white/40 dark:bg-white/[0.03] border-b border-white/20 dark:border-white/[0.06]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white rounded-xl flex items-center justify-center shadow-lg shadow-gray-900/20">
                <Volume2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">QianYU TTS</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">文本转语音工具</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 backdrop-blur-lg bg-white/30 dark:bg-white/[0.05] border border-white/20 dark:border-white/[0.08] rounded-full">
                <div className={`w-2 h-2 rounded-full ${health?.model_loaded ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-amber-500 shadow-lg shadow-amber-500/50"}`} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {health?.model_loaded ? "模型已加载" : "模型未加载"}
                </span>
              </div>
              <div className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 px-3 py-1.5 backdrop-blur-lg bg-white/30 dark:bg-white/[0.04] border border-white/20 dark:border-white/[0.06] rounded-full">
                {health?.mode || "unknown"}
              </div>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-hidden">
        <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] gap-6">
          {/* Sidebar Navigation */}
          <nav className="min-w-0">
            <div className="isolate overflow-hidden backdrop-blur-xl bg-white/40 dark:bg-white/[0.04] border border-white/20 dark:border-white/[0.06] rounded-2xl p-3 shadow-lg shadow-black/[0.03] dark:shadow-black/20">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = selectedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full h-[66px] box-border flex items-center space-x-3 px-4 py-3 rounded-xl ${
                        isActive
                          ? "bg-gradient-to-r from-gray-900/15 to-gray-900/15 dark:from-white/10 dark:to-white/10 text-gray-900 dark:text-gray-100 border border-gray-300/30 dark:border-gray-400/15 shadow-sm"
                          : "border border-transparent shadow-sm shadow-transparent text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-gray-700 dark:text-white" : "text-gray-400 dark:text-gray-500"}`} />
                      <div className="text-left min-w-0">
                        <div className="text-sm font-medium truncate">{tab.label}</div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{tab.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Content Area */}
          <div className="min-w-0 min-h-0 rounded-2xl overflow-hidden">
            <div ref={contentRef} className="h-full overflow-y-auto rounded-2xl scrollbar-none">
              <div className={`min-h-full backdrop-blur-xl bg-white/50 dark:bg-white/[0.04] border border-white/25 dark:border-white/[0.07] rounded-2xl p-6 shadow-xl shadow-black/[0.04] dark:shadow-black/25 transition-opacity duration-[180ms] ease-out ${isTabFading ? "opacity-0" : "opacity-100"}`}>
              <div className={activeTab === "voice-design" ? "block" : "hidden"}>
                <VoiceDesign />
              </div>
              <div className={activeTab === "voice-clone" ? "block" : "hidden"}>
                <VoiceClone />
              </div>
              <div className={activeTab === "custom-voice" ? "block" : "hidden"}>
                <CustomVoice />
              </div>
              <div className={activeTab === "voice-manager" ? "block" : "hidden"}>
                <VoiceManager />
              </div>
              <div className={activeTab === "settings" ? "block" : "hidden"}>
                <Settings health={health} onRefresh={checkHealth} />
              </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
