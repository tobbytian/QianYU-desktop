# faster-cuda-qwen3 优化引擎

## 概述
CUDA 图优化推理引擎，API 服务器和 WebUI 的主引擎。

## 结构
```
faster-cuda-qwen3/
├── LICENSE (MIT)
└── faster_qwen3_tts/
    ├── __init__.py          # 导出 FasterQwen3TTS
    ├── cli.py               # CLI 接口
    ├── generate.py          # 生成逻辑
    ├── model.py             # 模型封装
    ├── predictor_graph.py   # CUDA 图：预测器
    ├── sampling.py          # 采样策略
    ├── streaming.py         # 流式音频生成
    ├── talker_graph.py      # CUDA 图：说话器
    └── utils.py             # 工具函数
```

## 代码导航
| 任务 | 文件 |
|------|------|
| 修改推理流程 | `generate.py` |
| 修改 CUDA 图优化 | `predictor_graph.py`, `talker_graph.py` |
| 修改流式生成 | `streaming.py` |
| 修改采样策略 | `sampling.py` |
| 修改模型加载 | `model.py` |

## 关键特性
- **主引擎**：API 服务器始终使用，WebUI 的语音克隆/声音设计/自定义音色使用
- **CUDA 图捕获**：`predictor_graph.py` 和 `talker_graph.py` 实现 CUDA 图优化
- **流式支持**：标准 `Qwen3TTSModel` 不支持流式，此引擎支持
- **CPU 兼容**：CPU 模式下跳过 CUDA 图预热

## 安装方式
**非 pip 安装**，由 `bin/env_setup.py` 添加到 `sys.path`：
```python
sys.path.insert(0, os.path.join(PROJECT_ROOT, "faster-cuda-qwen3"))
```

## 导入方式
```python
from faster_qwen3_tts import FasterQwen3TTS
```

## 许可证
MIT
