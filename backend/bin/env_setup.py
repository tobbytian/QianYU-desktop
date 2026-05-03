"""Shared environment setup for all entry points.

Usage:
    import env_setup  # side effects: PATH, sys.path, offline mode, SSL patch
"""
import os
import sys

# --- Project root detection ---
_bin_dir = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(_bin_dir) if os.path.basename(_bin_dir).lower() == "bin" else _bin_dir

# --- Add bin/tools to PATH (sox, ffmpeg) ---
_tools_dir = os.path.join(PROJECT_ROOT, "bin", "tools")
if os.path.isdir(_tools_dir):
    os.environ["PATH"] = _tools_dir + os.pathsep + os.environ.get("PATH", "")

# --- Add faster-qwen3-tts to sys.path ---
_faster_dir = os.path.join(PROJECT_ROOT, "faster-cuda-qwen3")
if os.path.isdir(_faster_dir):
    sys.path.insert(0, _faster_dir)

# --- Add Qwen3-TTS to sys.path ---
_qwen_tts_dir = os.path.join(PROJECT_ROOT, "Qwen3-TTS")
if os.path.isdir(_qwen_tts_dir):
    sys.path.insert(0, _qwen_tts_dir)

# --- Offline mode ---
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("MODELSCOPE_OFFLINE", "1")
os.environ.setdefault("PYTHONHTTPSVERIFY", "0")

# --- SSL verification bypass ---
import ssl
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass
