#!/usr/bin/env python3
"""
Unified TTS API Server for Qwen3-TTS
Supports Voice Design, Voice Clone, and Custom Voice modes.
Model is loaded on demand based on the requested mode.

Usage:
    python bin/tts_api_unified.py -p 8088
"""
import env_setup  # noqa: F401 - sets up PATH, sys.path, offline mode

import os
import logging
import queue
import threading
import argparse
import time
import traceback
import tempfile
import shutil
from datetime import datetime

import asyncio
import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional

from faster_qwen3_tts import FasterQwen3TTS
from voice_manager import (
    get_voice_registry, save_voice_registry, get_next_voice_id,
    get_saved_voices, load_voice, parse_voice_items,
    VOICE_CACHE, SAVED_VOICES_DIR,
)
from audio_utils import tensor_to_numpy, to_pcm16, wav_header, wav_header_streaming
from model_utils import detect_device, unload_model as _unload_model_base

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Qwen3-TTS API (Unified)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_RATE = 24000

# ── Model paths ───────────────────────────────────────────────────

def _model_path(name):
    return os.path.join(env_setup.PROJECT_ROOT, "models", name).replace("\\", "/")

MODEL_PATHS = {
    "voice_design": _model_path("Qwen3-TTS-12Hz-1.7B-VoiceDesign"),
    "voice_clone": _model_path("Qwen3-TTS-12Hz-1.7B-Base"),
    "custom_voice": _model_path("Qwen3-TTS-12Hz-1.7B-CustomVoice"),
}

# ── Model management (single model at a time) ─────────────────────

_current_model = None
_current_type = None
_model_lock = threading.Lock()
_model_load_error = None

STREAMING_MODE = False
MODE_LOCK = threading.Lock()
CHUNK_SIZE = 8
CHUNK_SIZE_LOCK = threading.Lock()
FORCE_CPU = False
DEVICE_LOCK = threading.Lock()


def _detect_device():
    with DEVICE_LOCK:
        force_cpu = FORCE_CPU
    return detect_device(force_cpu=force_cpu)


def unload_model():
    global _current_model, _current_type, _model_load_error
    if _current_model is not None:
        _unload_model_base(_current_model, _current_type)
        _current_model = None
        _current_type = None
        _model_load_error = None


def load_model_for(mode: str):
    """Load the model for the given mode, switching if needed."""
    global _current_model, _current_type, _model_load_error, SAMPLE_RATE

    if _current_type == mode:
        return _current_model

    unload_model()

    if _model_load_error:
        raise RuntimeError(f"Previous model load failed: {_model_load_error}")

    model_path = MODEL_PATHS.get(mode)
    if not model_path:
        raise ValueError(f"Unknown mode: {mode}")

    device, compute_dtype, attn_mode, use_cuda = _detect_device()
    logger.info(f"Loading model for '{mode}' from {model_path}...")

    try:
        _current_model = FasterQwen3TTS.from_pretrained(
            model_path,
            device=device,
            dtype=compute_dtype,
            attn_implementation=attn_mode,
        )
        SAMPLE_RATE = _current_model.sample_rate
        _current_type = mode
        logger.info(f"Model loaded for '{mode}'. Sample rate: {SAMPLE_RATE} Hz")

        if use_cuda:
            logger.info("Warming up CUDA Graph (prefill_len=100)...")
            _current_model._warmup(prefill_len=100)
            logger.info("Warmup complete!")
        else:
            logger.info("CPU mode: skipping CUDA Graph warmup")

        return _current_model
    except Exception as e:
        _model_load_error = f"{type(e).__name__}: {str(e)}"
        logger.error(f"Model load failed: {_model_load_error}")
        traceback.print_exc()
        raise


# ── Chunk size / mode helpers ─────────────────────────────────────

def get_chunk_size():
    with CHUNK_SIZE_LOCK:
        return CHUNK_SIZE

def set_chunk_size(size: int):
    global CHUNK_SIZE
    with CHUNK_SIZE_LOCK:
        CHUNK_SIZE = max(1, size)
        return CHUNK_SIZE

def get_mode():
    with MODE_LOCK:
        return STREAMING_MODE

def toggle_mode():
    global STREAMING_MODE
    with MODE_LOCK:
        STREAMING_MODE = not STREAMING_MODE
        return STREAMING_MODE


# ── Streaming generator helper ────────────────────────────────────

async def _stream_generator(producer_func, model, fmt):
    """Generic streaming: run producer in a thread, yield chunks async."""
    total_samples = 0
    gen_start = None
    gen_end = None
    chunk_size = get_chunk_size()

    q = queue.Queue()
    _DONE = object()

    def producer():
        nonlocal gen_start, gen_end
        try:
            gen_start = time.time()
            with _model_lock:
                for chunk, sr, timing in producer_func(model, chunk_size):
                    q.put(tensor_to_numpy(chunk))
            gen_end = time.time()
        except Exception as exc:
            gen_end = time.time()
            logger.error(f"Generation error: {exc}")
            traceback.print_exc()
            q.put(exc)
        finally:
            q.put(_DONE)

    thread = threading.Thread(target=producer, daemon=True)
    thread.start()

    loop = asyncio.get_event_loop()
    chunk_count = 0
    while True:
        item = await loop.run_in_executor(None, q.get)
        chunk_count += 1
        if item is _DONE:
            gen_time = (gen_end - gen_start) if gen_end and gen_start else 0
            audio_time = total_samples / SAMPLE_RATE
            rtf = audio_time / gen_time if gen_time > 0 else 0
            logger.info(f"Streaming done: {chunk_count} chunks, RTF={rtf:.2f}x")
            break
        if isinstance(item, Exception):
            raise item
        pcm_bytes = to_pcm16(item)
        total_samples += len(item)
        yield pcm_bytes


# ── Generation functions ──────────────────────────────────────────

async def stream_voice_design(text: str, instruct: str, language: str):
    model = load_model_for("voice_design")

    def producer(m, chunk_size):
        return m.generate_voice_design_streaming(
            text=text, instruct=instruct, language=language,
            chunk_size=chunk_size, non_streaming_mode=False,
        )

    async for chunk in _stream_generator(producer, model, "wav"):
        yield chunk


async def generate_voice_design_sync(text: str, instruct: str, language: str):
    model = load_model_for("voice_design")
    with _model_lock:
        wavs, sr = model.generate_voice_design(text=text, instruct=instruct, language=language)
    return to_pcm16(tensor_to_numpy(wavs[0]))


async def stream_voice_clone(text: str, language: str, ref_audio_path: str, ref_text: str = ""):
    model = load_model_for("voice_clone")
    xvec_only = not ref_text or not ref_text.strip()

    def producer(m, chunk_size):
        return m.generate_voice_clone_streaming(
            text=text, language=language, ref_audio=ref_audio_path,
            ref_text=ref_text if not xvec_only else None,
            xvec_only=xvec_only,
            chunk_size=chunk_size, non_streaming_mode=False,
        )

    async for chunk in _stream_generator(producer, model, "wav"):
        yield chunk


async def generate_voice_clone_sync(text: str, language: str, ref_audio_path: str, ref_text: str = ""):
    model = load_model_for("voice_clone")
    xvec_only = not ref_text or not ref_text.strip()
    with _model_lock:
        wavs, sr = model.generate_voice_clone(
            text=text, language=language, ref_audio=ref_audio_path,
            ref_text=ref_text if not xvec_only else None,
            xvec_only=xvec_only,
        )
    return to_pcm16(tensor_to_numpy(wavs[0]))


async def stream_voice_clone_with_saved(text: str, language: str, voice_id: str):
    model = load_model_for("voice_clone")
    items = _get_voice_items(voice_id)

    def producer(m, chunk_size):
        return m.generate_voice_clone_streaming(
            text=text, language=language, voice_clone_prompt=items,
            chunk_size=chunk_size, non_streaming_mode=False,
        )

    async for chunk in _stream_generator(producer, model, "wav"):
        yield chunk


async def generate_voice_clone_with_saved_sync(text: str, language: str, voice_id: str):
    model = load_model_for("voice_clone")
    items = _get_voice_items(voice_id)
    with _model_lock:
        wavs, sr = model.generate_voice_clone(text=text, language=language, voice_clone_prompt=items)
    return to_pcm16(tensor_to_numpy(wavs[0]))


async def stream_custom_voice(text: str, language: str, speaker: str, instruct: str = ""):
    model = load_model_for("custom_voice")

    def producer(m, chunk_size):
        return m.generate_custom_voice_streaming(
            text=text, language=language, speaker=speaker, instruct=instruct,
            chunk_size=chunk_size, non_streaming_mode=False,
        )

    async for chunk in _stream_generator(producer, model, "wav"):
        yield chunk


async def generate_custom_voice_sync(text: str, language: str, speaker: str, instruct: str = ""):
    model = load_model_for("custom_voice")
    with _model_lock:
        wavs, sr = model.generate_custom_voice(text=text, language=language, speaker=speaker, instruct=instruct)
    return to_pcm16(tensor_to_numpy(wavs[0]))


# ── Voice management helpers ──────────────────────────────────────

def _get_voice_items(voice_id: str):
    """Load voice items from cache or disk."""
    available_voices = get_saved_voices()
    voice_ids = [v["id"] for v in available_voices]

    if voice_id not in voice_ids:
        raise HTTPException(status_code=404, detail=f"Voice '{voice_id}' not found. Available: {voice_ids}")

    if voice_id in VOICE_CACHE:
        return VOICE_CACHE[voice_id]

    logger.info(f"Loading voice: {voice_id}")
    payload = load_voice(voice_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Voice file for '{voice_id}' not found on disk")
    items = parse_voice_items(payload)
    VOICE_CACHE[voice_id] = items
    return items


# ── Response helpers ──────────────────────────────────────────────

def _wav_response(pcm_bytes: bytes, fmt: str):
    if fmt == "wav":
        return Response(
            content=wav_header(SAMPLE_RATE, len(pcm_bytes)) + pcm_bytes,
            media_type="audio/wav",
        )
    return Response(content=pcm_bytes, media_type="audio/pcm")


def _wav_streaming_response(stream_gen, fmt: str):
    async def audio_stream():
        if fmt == "wav":
            yield wav_header_streaming(SAMPLE_RATE)
            await asyncio.sleep(0)
        chunk_count = 0
        async for chunk in stream_gen:
            chunk_count += 1
            yield chunk
            await asyncio.sleep(0)
        logger.info(f"Streaming complete! {chunk_count} chunks sent")

    return StreamingResponse(
        audio_stream(),
        media_type="audio/wav" if fmt == "wav" else "audio/pcm",
        status_code=200,
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


def _parse_fmt(response_format: str):
    fmt = response_format.lower()
    if fmt == "mp3":
        fmt = "wav"
    if fmt not in ("wav", "pcm"):
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}. Use wav or pcm")
    return fmt


# ── API endpoints ─────────────────────────────────────────────────

class SpeechRequest(BaseModel):
    model: str = "tts-1"
    input: str = ""
    voice: str = "alloy"
    response_format: str = "wav"
    speed: float = 1.0
    voice_description: str = ""
    language: str = "Auto"
    speaker: str = ""
    ref_text: str = ""


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": _current_model is not None,
        "current_model": _current_type,
        "mode": "streaming" if get_mode() else "non-streaming",
        "error": _model_load_error,
    }


@app.get("/v1/voices")
async def list_voices():
    return {"voices": get_saved_voices(), "object": "list"}


@app.post("/v1/voices")
async def save_voice_endpoint(
    name: str = Form(...),
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(""),
):
    """Save a voice from reference audio for later reuse."""
    tmp_path = None
    try:
        suffix = os.path.splitext(ref_audio.filename or ".wav")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(ref_audio.file, tmp)
            tmp_path = tmp.name

        model = load_model_for("voice_clone")
        use_xvec = not ref_text or not ref_text.strip()

        with _model_lock:
            items = model.create_voice_clone_prompt(
                ref_audio=tmp_path,
                ref_text=ref_text if not use_xvec else None,
                x_vector_only_mode=use_xvec,
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
                "name": name,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "ref_text": ref_text if ref_text else "",
                "x_vector_only_mode": use_xvec,
            }
        }

        torch.save(payload, voice_file)

        registry = get_voice_registry()
        registry["voices"].append({
            "id": voice_id,
            "name": name,
            "file": f"{voice_id}.pt",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ref_text": ref_text if ref_text else "",
        })
        save_voice_registry(registry)

        return {"voice_id": voice_id, "name": name, "status": "saved"}
    except Exception as e:
        logger.error(f"Save voice failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.delete("/v1/voices/{voice_id}")
async def delete_voice_endpoint(voice_id: str):
    voice_file = os.path.join(SAVED_VOICES_DIR, f"{voice_id}.pt")
    if os.path.exists(voice_file):
        os.remove(voice_file)
    if voice_id in VOICE_CACHE:
        del VOICE_CACHE[voice_id]

    registry = get_voice_registry()
    registry["voices"] = [v for v in registry["voices"] if v["id"] != voice_id]
    save_voice_registry(registry)
    return {"status": "deleted", "voice_id": voice_id}


@app.post("/v1/audio/speech")
async def create_speech(req: SpeechRequest):
    if not req.input.strip():
        raise HTTPException(status_code=400, detail="'input' text is empty")

    fmt = _parse_fmt(req.response_format)
    language = req.language or "Auto"
    streaming = get_mode()

    try:
        # ── Voice Design mode ──
        if req.voice_description and req.voice_description.strip():
            instruct = req.voice_description.strip()
            logger.info(f"Voice Design: instruct='{instruct[:40]}...', streaming={streaming}")
            if streaming:
                return _wav_streaming_response(stream_voice_design(req.input, instruct, language), fmt)
            else:
                pcm = await generate_voice_design_sync(req.input, instruct, language)
                return _wav_response(pcm, fmt)

        # ── Custom Voice mode ──
        if req.speaker and req.speaker.strip():
            speaker = req.speaker.strip()
            instruct = req.voice_description.strip() if req.voice_description else ""
            logger.info(f"Custom Voice: speaker={speaker}, streaming={streaming}")
            if streaming:
                return _wav_streaming_response(stream_custom_voice(req.input, language, speaker, instruct), fmt)
            else:
                pcm = await generate_custom_voice_sync(req.input, language, speaker, instruct)
                return _wav_response(pcm, fmt)

        # ── Voice Clone mode (saved voice) ──
        voice_id = req.voice
        if voice_id and voice_id not in ("alloy", "voice_003"):
            logger.info(f"Voice Clone (saved): voice={voice_id}, streaming={streaming}")
            if streaming:
                return _wav_streaming_response(stream_voice_clone_with_saved(req.input, language, voice_id), fmt)
            else:
                pcm = await generate_voice_clone_with_saved_sync(req.input, language, voice_id)
                return _wav_response(pcm, fmt)

        # ── Fallback: no valid mode specified ──
        raise HTTPException(
            status_code=400,
            detail="No generation mode specified. Provide voice_description (Voice Design), "
                   "speaker (Custom Voice), or voice ID (Voice Clone)."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/audio/speech/upload")
async def create_speech_upload(
    text: str = Form(...),
    language: str = Form("Auto"),
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(""),
    response_format: str = Form("wav"),
):
    """Voice Clone with file upload."""
    if not text.strip():
        raise HTTPException(status_code=400, detail="'input' text is empty")

    fmt = _parse_fmt(response_format)
    streaming = get_mode()

    tmp_path = None
    try:
        suffix = os.path.splitext(ref_audio.filename or ".wav")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(ref_audio.file, tmp)
            tmp_path = tmp.name

        logger.info(f"Voice Clone (upload): ref={ref_audio.filename}, streaming={streaming}")
        if streaming:
            return _wav_streaming_response(stream_voice_clone(text, language, tmp_path, ref_text), fmt)
        else:
            pcm = await generate_voice_clone_sync(text, language, tmp_path, ref_text)
            return _wav_response(pcm, fmt)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Model management endpoints ────────────────────────────────────

@app.get("/api/models")
async def get_models():
    return {
        "models": MODEL_PATHS,
        "current": _current_type,
        "loaded": _current_model is not None,
    }


@app.post("/api/models/load")
async def load_model_endpoint(mode: str = Form(...)):
    if mode not in MODEL_PATHS:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}. Use: {list(MODEL_PATHS.keys())}")
    try:
        load_model_for(mode)
        return {"status": "loaded", "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/models/unload")
async def unload_model_endpoint():
    unload_model()
    return {"status": "unloaded"}


# ── Settings endpoints ────────────────────────────────────────────

class ModeRequest(BaseModel):
    mode: str


@app.post("/api/mode")
async def set_mode(req: ModeRequest):
    global STREAMING_MODE
    with MODE_LOCK:
        STREAMING_MODE = (req.mode == "streaming")
    return {"mode": "streaming" if STREAMING_MODE else "non-streaming"}


class ChunkSizeRequest(BaseModel):
    size: int


@app.post("/api/chunk-size")
async def set_chunk_size_endpoint(req: ChunkSizeRequest):
    new_size = set_chunk_size(req.size)
    return {"chunk_size": new_size}


# ── CLI args ──────────────────────────────────────────────────────

def _parse_args():
    p = argparse.ArgumentParser(description="Qwen3-TTS API Server (Unified)")
    p.add_argument("--port", "-p", type=int, default=8088, help="API server port")
    p.add_argument("--host", default="0.0.0.0", help="Bind host")
    p.add_argument("--preload", action="store_true", default=False, help="Preload voice_design model at startup")
    p.add_argument("--mode", choices=["streaming", "non-streaming"], default="streaming", help="Initial mode")
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    with MODE_LOCK:
        STREAMING_MODE = (args.mode == "streaming")

    logger.info(f"Server: http://{args.host}:{args.port}")
    logger.info(f"Models: {list(MODEL_PATHS.keys())}")
    logger.info(f"Mode: {'STREAMING' if STREAMING_MODE else 'NON-STREAMING'}")

    if args.preload:
        logger.info("Preloading voice_design model...")
        try:
            load_model_for("voice_design")
            logger.info("Model preloaded successfully")
        except Exception as e:
            logger.error(f"Model preload failed: {e}")

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
