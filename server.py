"""
QianYU TTS Server - 独立版本
使用本项目的Python环境和代码
"""
import os
import sys
import argparse
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.absolute()
BACKEND_DIR = PROJECT_ROOT / "backend"

# 设置路径
BIN_DIR = BACKEND_DIR / "bin"
FASTER_DIR = BACKEND_DIR / "faster-cuda-qwen3"
QWEN_TTS_DIR = BACKEND_DIR / "Qwen3-TTS"
MODELS_DIR = BACKEND_DIR / "models"
PYTHON_DIR = BACKEND_DIR / "WPy64-312101" / "python"

# 添加本项目路径到 sys.path
sys.path.insert(0, str(BIN_DIR))
sys.path.insert(0, str(FASTER_DIR))
sys.path.insert(0, str(QWEN_TTS_DIR))

# 设置环境变量
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["MODELSCOPE_OFFLINE"] = "1"
os.environ["PYTHONHTTPSVERIFY"] = "0"

# 导入项目模块
from env_setup import PROJECT_ROOT as ENV_PROJECT_ROOT
from tts_api_unified import app, load_model, DEFAULT_VOICE_ID

def main():
    parser = argparse.ArgumentParser(description="QianYU TTS Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8088, help="Port to bind to")
    parser.add_argument("--voice-id", "-v", default=DEFAULT_VOICE_ID, help="Default voice ID")
    parser.add_argument("--mode", choices=["streaming", "non-streaming"], default="streaming", help="Initial mode")
    parser.add_argument("--preload", action="store_true", help="Preload model at startup")
    args = parser.parse_args()

    # 更新原项目的模型路径
    import tts_api_unified
    tts_api_unified.MODEL_PATH = str(MODELS_DIR / "Qwen3-TTS-12Hz-1.7B-Base")

    print(f"=" * 60)
    print(f"QianYU TTS Server")
    print(f"=" * 60)
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Models directory: {MODELS_DIR}")
    print(f"Default model: {tts_api_unified.MODEL_PATH}")
    print(f"Server: http://{args.host}:{args.port}")
    print(f"Voice ID: {args.voice_id}")
    print(f"Mode: {args.mode}")
    print(f"=" * 60)

    if args.preload:
        print("Preloading model...")
        try:
            load_model()
            print("Model preloaded successfully!")
        except Exception as e:
            print(f"Preload failed: {e}")

    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")

if __name__ == "__main__":
    main()
