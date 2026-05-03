# bin/ 模块指南

## 概述
应用层代码：API 服务器、WebUI、共享工具模块。

## 结构
```
bin/
├── env_setup.py          # 环境初始化（必须首先导入）
├── tts_api_unified.py    # FastAPI API 服务器 (455 行)
├── integrated_app.py     # Gradio WebUI (449 行)
├── clean_launch.py       # WebUI 启动器
├── voice_manager.py      # 语音注册表 CRUD (87 行)
├── audio_utils.py        # 音频处理工具 (70 行)
├── model_utils.py        # 模型管理工具 (60 行)
├── make_cert.py          # TLS 证书生成器
└── tools/                # sox.exe, ffmpeg.exe + DLL
```

## 代码导航
| 任务 | 文件 | 关键函数/变量 |
|------|------|--------------|
| 添加 API 端点 | `tts_api_unified.py` | `@app.post("/v1/...")` |
| 修改 WebUI 界面 | `integrated_app.py` | `gr.Blocks()` |
| 管理语音 | `voice_manager.py` | `get_voice_registry()`, `load_voice()` |
| 音频格式转换 | `audio_utils.py` | `tensor_to_numpy()`, `to_pcm16()` |
| 设备检测 | `model_utils.py` | `detect_device(force_cpu=False)` |

## 约定

### 导入顺序（强制）
```python
import env_setup  # noqa: F401 - 必须第一行
# 然后标准库
import os, sys
# 然后第三方
import torch, numpy
# 然后项目模块
from voice_manager import ...
from audio_utils import ...
```

### 全局状态模式
**tts_api_unified.py** 使用线程锁保护的全局变量：
- `_model` + `_model_lock` — 模型实例
- `STREAMING_MODE` + `MODE_LOCK` — 流式开关
- `CHUNK_SIZE` + `CHUNK_SIZE_LOCK` — chunk 大小
- `FORCE_CPU` + `DEVICE_LOCK` — 设备切换

**integrated_app.py** 使用全局变量：
- `current_model` — 当前模型
- `current_type` — 模型类型
- `current_model_is_faster` — 是否 faster 后端

## 反模式
- **禁止**绕过 `env_setup.py` 直接设置 PATH/sys.path
- **禁止**在锁外修改全局状态
- **禁止**在音频处理函数中调用 `gc.collect()`（性能问题）
- **禁止**删除 `noqa: F401` 注释（env_setup 导入是副作用导入）
