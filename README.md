# QianYU Desktop

基于 [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) 的文本转语音桌面应用，使用 [Tauri](https://tauri.app/) 构建。

## 功能特性

- **声音设计** — 通过自然语言描述创建定制化音色
- **语音克隆** — 基于参考音频复刻目标声音
- **自定义音色** — 使用官方预设的高质量说话人
- **流式生成** — 支持实时流式音频输出
- **GPU/CPU 自动切换** — 自动检测 CUDA 并选择最佳设备

## 环境要求

- Windows 10/11
- Node.js 18+
- Rust 1.70+
- Python 3.12（用于构建 sidecar）
- NVIDIA GPU（推荐 8GB+ 显存）或 CPU

## 开发环境设置

### 1. 克隆仓库

```bash
git clone <repo-url>
cd QianYU-desktop
```

### 2. 安装前端依赖

```bash
npm install
```

### 3. 下载模型

```bash
python scripts/download-models.py
```

或手动从 HuggingFace 下载模型到 `models/` 目录：
- [Qwen3-TTS-12Hz-1.7B-Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)
- [Qwen3-TTS-12Hz-1.7B-VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign)
- [Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice)

### 4. 构建 Python Sidecar

```bash
scripts\build-sidecar.bat
```

### 5. 运行开发服务器

```bash
npm run tauri dev
```

## 构建发布版本

```bash
npm run tauri build
```

构建完成后，安装程序将在 `src-tauri/target/release/bundle/` 目录中生成。

## 项目结构

```
QianYU-desktop/
├── src/                        # React 前端
│   ├── components/             # UI 组件
│   ├── hooks/                  # React Hooks
│   ├── services/               # API 服务
│   ├── App.tsx                 # 主应用
│   └── main.tsx                # 入口文件
├── src-tauri/                  # Tauri 后端
│   ├── src/                    # Rust 源码
│   ├── binaries/               # Sidecar 可执行文件
│   ├── capabilities/           # 权限配置
│   └── tauri.conf.json         # Tauri 配置
├── python-backend/             # Python TTS 后端
│   ├── server.py               # FastAPI 服务器
│   └── build.spec              # PyInstaller 配置
├── scripts/                    # 构建脚本
│   ├── build-sidecar.bat       # 构建 sidecar
│   └── download-models.py      # 下载模型
└── package.json                # 前端依赖
```

## 许可证

- Qwen3-TTS: Apache-2.0
- Tauri: MIT / Apache-2.0
