import env_setup  # noqa: F401 - sets up PATH, sys.path, offline mode

import os
import time
import gc
from datetime import datetime

import torch
import numpy as np
import gradio as gr
from qwen_tts import Qwen3TTSModel
from faster_qwen3_tts import FasterQwen3TTS

from voice_manager import (
    get_voice_registry, save_voice_registry, get_next_voice_id,
    get_saved_voices, load_voice, parse_voice_items,
    VOICE_CACHE, SAVED_VOICES_DIR,
)
from audio_utils import tensor_to_numpy, collect_streaming_chunks
from model_utils import detect_device, unload_model as _unload_model_base

# ── Model paths ───────────────────────────────────────────────────

def _model_path(name):
    return os.path.join(env_setup.PROJECT_ROOT, "models", name).replace("\\", "/")

MODEL_PATHS = {
    "声音设计": _model_path("Qwen3-TTS-12Hz-1.7B-VoiceDesign"),
    "语音克隆": _model_path("Qwen3-TTS-12Hz-1.7B-Base"),
    "自定义音色": _model_path("Qwen3-TTS-12Hz-1.7B-CustomVoice"),
}

FASTER_MODEL_TYPES = {"语音克隆", "声音设计", "自定义音色"}

# ── Model management ──────────────────────────────────────────────

current_model = None
current_type = None
current_model_is_faster = False

ENABLE_STREAMING = False
CHUNK_SIZE = 8


def set_streaming_mode(enabled: bool):
    global ENABLE_STREAMING
    ENABLE_STREAMING = enabled
    print(f"[设置] 流式生成: {'开启' if enabled else '关闭'}")


def set_chunk_size(size: int):
    global CHUNK_SIZE
    CHUNK_SIZE = size
    print(f"[设置] Chunk Size: {size}")


def _detect_device():
    """Return (device, device_map, compute_dtype, attn_mode, use_cuda)."""
    device, compute_dtype, attn_mode, use_cuda = detect_device()
    device_map = device  # device_map same as device for Gradio
    return device, device_map, compute_dtype, attn_mode, use_cuda


def unload_model():
    global current_model, current_type, current_model_is_faster
    if current_model is not None:
        _unload_model_base(current_model, current_type)
        current_model = None
        current_type = None
        current_model_is_faster = False


def load_model(m_type):
    global current_model, current_type, current_model_is_faster
    if current_type == m_type:
        return current_model

    unload_model()
    device, device_map, compute_dtype, attn_mode, use_cuda = _detect_device()
    use_faster = m_type in FASTER_MODEL_TYPES

    try:
        if use_faster:
            print(f"[显存管理] 正在加载 Faster 模型: {m_type}...")
            current_model = FasterQwen3TTS.from_pretrained(
                MODEL_PATHS[m_type],
                device=device,
                dtype=compute_dtype,
                attn_implementation=attn_mode,
            )
            if use_cuda:
                print("[硬件加速] CUDA Graph 预热中 (prefill_len=100)...")
                current_model._warmup(prefill_len=100)
                print("[硬件加速] 预热完成！")
            else:
                print("[CPU模式] 跳过 CUDA Graph 预热")
        else:
            print(f"[显存管理] 正在加载: {m_type} 模型...")
            current_model = Qwen3TTSModel.from_pretrained(
                MODEL_PATHS[m_type],
                device_map=device_map,
                attn_implementation=attn_mode,
                dtype=compute_dtype,
                local_files_only=True,
            )

        current_type = m_type
        current_model_is_faster = use_faster
        print(f"[完成] 模型 {m_type} 加载成功！")
        return current_model

    except Exception as e:
        print(f"[错误] 模型加载失败: {e}")
        print("[提示] 如果使用 CPU 模式出错，请检查模型是否支持 CPU 推理")
        raise


# ── Generation functions ──────────────────────────────────────────

def _generate_with_streaming(model, generator_func, streaming_args, non_streaming_func, non_streaming_args):
    """Unified streaming/non-streaming generation dispatcher."""
    start_time = time.time()

    if ENABLE_STREAMING and current_model_is_faster:
        print(f"[生成] 流式模式, chunk_size={CHUNK_SIZE}")
        audio, sr = collect_streaming_chunks(generator_func(**streaming_args))
    else:
        wavs, sr = non_streaming_func(**non_streaming_args)
        audio = tensor_to_numpy(wavs[0])

    elapsed = time.time() - start_time
    audio_len = len(audio) / sr
    rtf = audio_len / elapsed if elapsed > 0 else 0
    mode_str = f"流式({CHUNK_SIZE})" if ENABLE_STREAMING else "非流式"
    status_msg = f"完成! {mode_str} {elapsed:.1f}s / {audio_len:.1f}s / {rtf:.1f}x"
    return (sr, audio), status_msg


def fn_voice_design(text, lang, instruct):
    model = load_model("声音设计")
    if model is None:
        return None, "错误：找不到模型文件"

    return _generate_with_streaming(
        model,
        model.generate_voice_design_streaming,
        dict(text=text, language=lang, instruct=instruct, chunk_size=CHUNK_SIZE, non_streaming_mode=False),
        model.generate_voice_design,
        dict(text=text, language=lang, instruct=instruct),
    )


def fn_voice_clone(text, lang, ref_audio, ref_text):
    model = load_model("语音克隆")
    if model is None:
        return None, "错误：找不到模型文件"

    use_x_vector = not ref_text or str(ref_text).strip() == ""
    status_prefix = "零样本" if use_x_vector else "ICL"

    try:
        print(f"[语音克隆] 生成中... xvec_only={use_x_vector}, streaming={ENABLE_STREAMING}")

        # Build args that differ between faster/non-faster backends
        streaming_args = dict(
            text=text, language=lang, ref_audio=ref_audio,
            ref_text=ref_text, xvec_only=use_x_vector,
            chunk_size=CHUNK_SIZE, non_streaming_mode=False,
        )
        non_streaming_args = dict(text=text, language=lang, ref_audio=ref_audio, ref_text=ref_text)
        if current_model_is_faster:
            non_streaming_args["xvec_only"] = use_x_vector
        else:
            non_streaming_args["x_vector_only_mode"] = use_x_vector

        result, status_msg = _generate_with_streaming(
            model,
            model.generate_voice_clone_streaming,
            streaming_args,
            model.generate_voice_clone,
            non_streaming_args,
        )
        # Prefix status with clone mode
        if result is not None:
            _, audio_data = result
            sr_val = result[0]
            elapsed_est = len(audio_data) / sr_val / 10  # rough estimate for prefix
            status_msg = f"{status_prefix} {status_msg}"
        return result, status_msg

    except Exception as e:
        print(f"[错误] {e}")
        import traceback
        traceback.print_exc()
        return None, f"失败: {str(e)}"


def fn_custom_voice(text, lang, speaker, instruct):
    model = load_model("自定义音色")
    if model is None:
        return None, "错误：找不到模型文件"

    return _generate_with_streaming(
        model,
        model.generate_custom_voice_streaming,
        dict(text=text, language=lang, speaker=speaker, instruct=instruct, chunk_size=CHUNK_SIZE, non_streaming_mode=False),
        model.generate_custom_voice,
        dict(text=text, language=lang, speaker=speaker, instruct=instruct),
    )


# ── Voice save/load/delete ────────────────────────────────────────

def get_saved_voices_list():
    registry = get_voice_registry()
    return [f"{v['id']} - {v['name']}" for v in registry.get("voices", [])]


def save_voice(ref_audio, ref_text, voice_name):
    model = load_model("语音克隆")
    if model is None:
        return "错误：找不到模型文件", gr.update()

    if not ref_audio:
        return "错误：请先上传参考音频", gr.update()

    use_x_vector = not ref_text or not str(ref_text).strip()
    ref_text_val = ref_text if not use_x_vector else None

    try:
        items = model.create_voice_clone_prompt(
            ref_audio=ref_audio,
            ref_text=ref_text_val,
            x_vector_only_mode=use_x_vector,
        )

        voice_id = get_next_voice_id()
        voice_file = os.path.join(SAVED_VOICES_DIR, f"{voice_id}.pt")

        payload = {
            "items": [{
                "ref_code": it.ref_code,
                "ref_spk_embedding": it.ref_spk_embedding,
                "x_vector_only_mode": it.x_vector_only_mode,
                "icl_mode": it.icl_mode,
                "ref_text": it.ref_text,
            } for it in items],
            "metadata": {
                "name": voice_name,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "ref_text": ref_text if ref_text else "",
                "x_vector_only_mode": use_x_vector,
            }
        }

        torch.save(payload, voice_file)

        registry = get_voice_registry()
        registry["voices"].append({
            "id": voice_id,
            "name": voice_name,
            "file": f"{voice_id}.pt",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ref_text": ref_text if ref_text else "",
        })
        save_voice_registry(registry)

        new_choices = get_saved_voices_list()
        return f"音色保存成功！ID: {voice_id}, 名称: {voice_name}", gr.update(choices=new_choices, value=f"{voice_id} - {voice_name}")
    except Exception as e:
        return f"保存失败: {str(e)}", gr.update()


def delete_voice(voice_id):
    voice_file = os.path.join(SAVED_VOICES_DIR, f"{voice_id}.pt")
    if os.path.exists(voice_file):
        os.remove(voice_file)
    if voice_id in VOICE_CACHE:
        del VOICE_CACHE[voice_id]

    registry = get_voice_registry()
    registry["voices"] = [v for v in registry["voices"] if v["id"] != voice_id]
    save_voice_registry(registry)

    new_choices = get_saved_voices_list()
    return f"已删除音色: {voice_id}", gr.update(choices=new_choices, value=None)


def fn_voice_clone_with_saved(text, lang, voice_selected):
    if not voice_selected:
        return None, "请先选择要使用的音色"

    voice_id = voice_selected.split(" - ")[0]
    model = load_model("语音克隆")
    if model is None:
        return None, "错误：找不到模型文件"

    start_time = time.time()

    try:
        if voice_id in VOICE_CACHE:
            items = VOICE_CACHE[voice_id]
        else:
            payload = load_voice(voice_id)
            if payload is None:
                return None, f"找不到音色文件: {voice_id}"
            items = parse_voice_items(payload)
            VOICE_CACHE[voice_id] = items

        wavs, sr = model.generate_voice_clone(
            text=text, language=lang, voice_clone_prompt=items,
        )

        audio = tensor_to_numpy(wavs[0])
        elapsed = time.time() - start_time
        audio_len = len(audio) / sr
        rtf = audio_len / elapsed if elapsed > 0 else 0
        status_msg = f"完成! {elapsed:.1f}s / {audio_len:.1f}s / {rtf:.1f}x"
        print(f"[INFO] {status_msg}")
        return (sr, audio), status_msg

    except Exception as e:
        print(f"[错误] {e}")
        import traceback
        traceback.print_exc()
        return None, f"生成失败: {str(e)}"


# ── Gradio UI ─────────────────────────────────────────────────────

def run_integrated(ip, port):
    langs = ["Chinese", "English", "Japanese", "Korean", "German", "French", "Russian", "Portuguese", "Spanish", "Italian", "Auto"]
    speakers = ["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"]

    with gr.Blocks(title="Qwen3-TTS 生活作弊码懒人包") as demo:
        gr.Markdown("# Qwen3-TTS 全能懒人包集成版")
        gr.Markdown("""
        ### 功能说明：
        - **声音设计 (Voice Design)**：通过自然语言描述（如"甜美的萝莉音"）直接创建定制化音色。
        - **语音克隆 (Voice Clone)**：基于一段参考音频和文本，完美复刻目标人物的声音。
        - **精品音色 (CustomVoice)**：使用官方预设的高质量说话人，支持愤怒、开心等多种情感控制。

        💡 **提示**：强烈建议先访问 https://qwen.ai/blog?id=qwen3tts-0115 ，这里有详细的演示和解释。

        - 本工具由阿里巴巴通义实验室 Qwen 团队研发，本项目已集成三个1.7B模型。切换标签页时会自动释放旧模型，建议显存8G及以上。
        """)

        with gr.Accordion("生成设置", open=True):
            gr.Markdown("配置流式生成参数")
            with gr.Row():
                streaming_check = gr.Checkbox(label="启用流式生成", value=False)
                chunk_size_slider = gr.Slider(minimum=1, maximum=24, value=8, step=1, label="Chunk Size")
                apply_btn = gr.Button("应用设置", variant="primary")
            settings_msg = gr.Textbox(label="状态", interactive=False)

        def update_settings(enabled, chunk_size):
            set_streaming_mode(enabled)
            set_chunk_size(chunk_size)
            return f"流式生成: {'开启' if enabled else '关闭'}, Chunk Size: {chunk_size}"

        apply_btn.click(update_settings, [streaming_check, chunk_size_slider], outputs=[settings_msg])

        with gr.Tabs() as tabs:
            with gr.Tab("声音设计 (Voice Design)", id="声音设计"):
                with gr.Row():
                    with gr.Column():
                        txt_in = gr.Textbox(label="文本", lines=3, value="哥哥，你回来啦，人家等了你好久好久了，要抱抱！")
                        lang_in = gr.Dropdown(langs, label="语言", value="Auto")
                        ins_in = gr.Textbox(label="声音描述", placeholder="例如：甜美的萝莉音", lines=2)
                        btn_gen = gr.Button("开始生成", variant="primary")
                    with gr.Column():
                        aud_out = gr.Audio(label="生成音频")
                        msg_out = gr.Textbox(label="状态")
                btn_gen.click(fn_voice_design, [txt_in, lang_in, ins_in], [aud_out, msg_out])

            with gr.Tab("语音克隆 (Voice Clone)", id="语音克隆"):
                with gr.Row():
                    with gr.Column():
                        txt_in_c = gr.Textbox(label="文本", lines=3, value="你好，很高兴见到你。")
                        lang_in_c = gr.Dropdown(langs, label="语言", value="Auto")
                        with gr.Accordion("参考音频与文本", open=True):
                            ref_aud = gr.Audio(label="参考音频", type="filepath")
                            ref_txt = gr.Textbox(label="参考文本", placeholder="参考音频里的台词")

                        with gr.Accordion("保存音色", open=True):
                            gr.Markdown("上传参考音频后，可保存音色以便后续复用")
                            with gr.Row():
                                save_name_in = gr.Textbox(label="音色名称", placeholder="给音色起个名字", scale=3)
                                btn_save_voice = gr.Button("保存音色", variant="secondary", scale=1)
                            save_msg_out = gr.Textbox(label="保存状态", interactive=False)

                        with gr.Accordion("使用已保存音色", open=True):
                            gr.Markdown("直接使用已保存的音色，无需重新上传音频")
                            with gr.Row():
                                voice_select = gr.Dropdown(label="选择音色", choices=get_saved_voices_list(), scale=3)
                                btn_use_saved = gr.Button("使用此音色", variant="primary", scale=1)
                                btn_del_voice = gr.Button("删除", variant="stop", scale=1)
                            use_msg_out = gr.Textbox(label="状态", interactive=False)

                        btn_gen_c = gr.Button("开始克隆（使用参考音频）", variant="primary")
                    with gr.Column():
                        aud_out_c = gr.Audio(label="生成音频")
                        msg_out_c = gr.Textbox(label="状态", show_label=True)

                btn_gen_c.click(fn_voice_clone, [txt_in_c, lang_in_c, ref_aud, ref_txt], [aud_out_c, msg_out_c])
                btn_save_voice.click(save_voice, [ref_aud, ref_txt, save_name_in], [save_msg_out, voice_select])
                btn_use_saved.click(fn_voice_clone_with_saved, [txt_in_c, lang_in_c, voice_select], [aud_out_c, use_msg_out])
                btn_del_voice.click(delete_voice, [voice_select], [use_msg_out, voice_select])

            with gr.Tab("自定义音色 (Custom Voice)", id="自定义音色"):
                with gr.Row():
                    with gr.Column():
                        txt_in_v = gr.Textbox(label="文本", lines=3, value="其实我真的有发现，我是一个特别善于观察别人情绪的人。")
                        lang_in_v = gr.Dropdown(langs, label="语言", value="Auto")
                        spk_in = gr.Dropdown(speakers, label="音色", value="Vivian")
                        ins_in_v = gr.Textbox(label="风格", placeholder="例如：用愤怒的语气")
                        btn_gen_v = gr.Button("开始合成", variant="primary")
                    with gr.Column():
                        aud_out_v = gr.Audio(label="生成音频")
                        msg_out_v = gr.Textbox(label="状态")
                btn_gen_v.click(fn_custom_voice, [txt_in_v, lang_in_v, spk_in, ins_in_v], [aud_out_v, msg_out_v])

        tabs.select(fn=lambda evt: load_model(evt.value))

    cert_path = os.path.join(env_setup.PROJECT_ROOT, "config", "cert.pem")
    key_path = os.path.join(env_setup.PROJECT_ROOT, "config", "key.pem")
    print(f"[INFO] 证书路径: {cert_path}")
    print(f"[INFO] 启动端口: {port}")

    launch_kwargs = {
        "server_name": ip,
        "ssl_certfile": cert_path,
        "ssl_keyfile": key_path,
        "ssl_verify": False,
        "show_error": True,
        "quiet": True,
    }

    if port != "7860":
        launch_kwargs["server_port"] = int(port)
    else:
        print("[INFO] 使用自动端口查找模式")

    demo.launch(**launch_kwargs)


if __name__ == "__main__":
    load_model("声音设计")
    run_integrated("127.0.0.1", "7860")
