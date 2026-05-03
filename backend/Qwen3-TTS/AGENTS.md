# Qwen3-TTS 上游包

## 概述
上游 `qwen-tts` 包源码，WebUI 的后备推理引擎。

## 结构
```
Qwen3-TTS/
├── LICENSE (Apache-2.0)
└── qwen_tts/
    ├── __init__.py          # 导出 Qwen3TTSModel
    ├── __main__.py          # CLI 入口
    ├── cli/demo.py          # CLI 演示 (574 行)
    ├── core/
    │   ├── models/          # 模型配置和处理
    │   ├── tokenizer_12hz/  # 12Hz 分词器
    │   └── tokenizer_25hz/  # 25Hz 分词器
    └── inference/
        ├── qwen3_tts_model.py      # 主模型类
        └── qwen3_tts_tokenizer.py  # 分词器
```

## 代码导航
| 任务 | 文件 |
|------|------|
| 修改模型推理逻辑 | `inference/qwen3_tts_model.py` |
| 修改分词器 | `inference/qwen3_tts_tokenizer.py` |
| 修改模型配置 | `core/models/configuration_qwen3_tts.py` |
| 运行 CLI 演示 | `python -m qwen_tts` |

## 重要说明
- **这是上游代码**，尽量少修改
- **后备引擎**：API 服务器使用 `faster_qwen3_tts`，仅 WebUI 在非 faster 模式时使用此包
- **两种分词器**：12Hz（默认）和 25hz，位于 `core/tokenizer_*hz/`
- **导入方式**：`from qwen_tts import Qwen3TTSModel`
- **许可证**：Apache-2.0
