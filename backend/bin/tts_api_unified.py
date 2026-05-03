#!/usr/bin/env python3
"""
Unified TTS API Server for Qwen3-TTS
Supports both streaming and non-streaming modes
Switch mode by typing 'mode' in the terminal

Usage:
    python bin/tts_api_unified.py -v voice_003 -p 8088
"""
import env_setup  # noqa: F401 - sets up PATH, sys.path, offline mode

import os
import logging
import queue
import threading
import argparse
import time
import traceback

import asyncio
import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from faster_qwen3_tts import FasterQwen3TTS
from voice_manager import (
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

SAMPLE_RATE = 24000
_model = None
_model_lock = threading.Lock()
_model_load_error = None

# Global mode switch: True = streaming, False = non-streaming
STREAMING_MODE = True
MODE_LOCK = threading.Lock()

# Global chunk size for streaming mode
CHUNK_SIZE = 2
CHUNK_SIZE_LOCK = threading.Lock()

# Global device preference: True = force CPU, False = use CUDA if available
FORCE_CPU = False
DEVICE_LOCK = threading.Lock()

DEFAULT_VOICE_ID = "voice_003"

MODEL_PATH = os.path.join(env_setup.PROJECT_ROOT, "models/Qwen3-TTS-12Hz-1.7B-Base").replace("\\", "/")


# ── Device detection ──────────────────────────────────────────────

def _detect_device():
    """Return (device, compute_dtype, attn_mode, use_cuda) based on FORCE_CPU and CUDA availability."""
    with DEVICE_LOCK:
        force_cpu = FORCE_CPU
    return detect_device(force_cpu=force_cpu)


# ── Model management ──────────────────────────────────────────────

def unload_model():
    """Unload current model to allow device switching."""
    global _model, _model_load_error
    if _model is not None:
        _unload_model_base(_model, "model")
        _model = None
        _model_load_error = None
    else:
        logger.info("No model loaded, nothing to unload")


def load_model():
    global _model, SAMPLE_RATE, _model_load_error
    if _model is not None:
        return _model

    if _model_load_error:
        logger.error(f"Previous model load failed: {_model_load_error}")
        raise RuntimeError(f"Model failed to load: {_model_load_error}")

    device, compute_dtype, attn_mode, use_cuda = _detect_device()
    logger.info(f"Loading model from {MODEL_PATH}...")

    try:
        _model = FasterQwen3TTS.from_pretrained(
            MODEL_PATH,
            device=device,
            dtype=compute_dtype,
            attn_implementation=attn_mode,
        )
        SAMPLE_RATE = _model.sample_rate
        logger.info(f"Model loaded. Sample rate: {SAMPLE_RATE} Hz")

        if use_cuda:
            logger.info("Warming up CUDA Graph (prefill_len=100)...")
            _model._warmup(prefill_len=100)
            logger.info("Warmup complete!")
        else:
            logger.info("CPU mode: skipping CUDA Graph warmup")

        return _model
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        _model_load_error = error_msg
        logger.error(f"Model load failed: {error_msg}")
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
        logger.info(f"Chunk size set to: {CHUNK_SIZE}")
        return CHUNK_SIZE

def get_mode():
    with MODE_LOCK:
        return STREAMING_MODE

def toggle_mode():
    global STREAMING_MODE
    with MODE_LOCK:
        STREAMING_MODE = not STREAMING_MODE
        mode_str = "streaming" if STREAMING_MODE else "non-streaming"
        logger.info("=" * 50)
        logger.info(f"Mode switched to: {mode_str.upper()}")
        logger.info("=" * 50)
        return STREAMING_MODE


# ── FastAPI endpoints ─────────────────────────────────────────────

class SpeechRequest(BaseModel):
    model: str = "tts-1"
    input: str = ""
    voice: str = "alloy"
    response_format: str = "wav"
    speed: float = 1.0

@app.post("/")
async def root_speech(req: SpeechRequest):
    logger.info(f"Received root POST: voice={req.voice}, input={req.input[:30] if req.input else 'empty'}...")
    logger.info(f"Using default voice: {DEFAULT_VOICE_ID}")
    return await create_speech(req)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": _model is not None,
        "mode": "streaming" if get_mode() else "non-streaming",
        "error": _model_load_error
    }

@app.get("/v1/voices")
async def list_voices():
    voices = get_saved_voices()
    return {"voices": voices, "object": "list"}


# ── Audio generation ──────────────────────────────────────────────

def _get_voice_items(voice_id: str):
    """Load voice items from cache or disk, falling back to default."""
    available_voices = get_saved_voices()
    voice_ids = [v["id"] for v in available_voices]

    if voice_id not in voice_ids:
        logger.warning(f"Voice '{voice_id}' not found, available: {voice_ids}. Using default: {DEFAULT_VOICE_ID}")
        voice_id = DEFAULT_VOICE_ID

    if voice_id in VOICE_CACHE:
        return voice_id, VOICE_CACHE[voice_id]

    logger.info(f"Loading voice: {voice_id}")
    payload = load_voice(voice_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Voice {voice_id} not found")
    items = parse_voice_items(payload)
    VOICE_CACHE[voice_id] = items
    logger.info(f"Voice '{voice_id}' loaded successfully")
    return voice_id, items


async def stream_audio(voice_id: str, text: str, fmt: str):
    total_samples = 0
    gen_start_time = None
    gen_end_time = None

    logger.info(f"stream_audio called: voice_id={voice_id}, text={text[:50]}...")
    model = load_model()
    voice_id, items = _get_voice_items(voice_id)

    q = queue.Queue()
    _DONE = object()
    chunk_index = 0
    current_chunk_size = get_chunk_size()

    def producer():
        nonlocal gen_start_time, gen_end_time
        try:
            gen_start_time = time.time()
            with _model_lock:
                logger.info(f"Starting generation with chunk_size={current_chunk_size}")
                for chunk, sr, timing in model.generate_voice_clone_streaming(
                    text=text,
                    language="Auto",
                    voice_clone_prompt=items,
                    chunk_size=current_chunk_size,
                    non_streaming_mode=False,
                ):
                    q.put(tensor_to_numpy(chunk))
            gen_end_time = time.time()
            logger.info("Generation complete, waiting for chunks to be sent...")
        except Exception as exc:
            gen_end_time = time.time()
            logger.error(f"Generation error: {exc}")
            traceback.print_exc()
            q.put(exc)
        finally:
            q.put(_DONE)

    thread = threading.Thread(target=producer, daemon=True)
    thread.start()

    loop = asyncio.get_event_loop()
    while True:
        item = await loop.run_in_executor(None, q.get)
        chunk_index += 1
        if item is _DONE:
            gen_time = (gen_end_time - gen_start_time) if gen_end_time and gen_start_time else 0
            audio_time = total_samples / SAMPLE_RATE
            rtf = audio_time / gen_time if gen_time > 0 else 0
            logger.info("=" * 40)
            logger.info(f"Streaming complete! Total chunks: {chunk_index}")
            logger.info(f"RTF: {rtf:.2f}x (生成 {gen_time:.2f}s / 音频 {audio_time:.2f}s)")
            logger.info("=" * 40)
            break
        if isinstance(item, Exception):
            raise item
        pcm_bytes = to_pcm16(item)
        total_samples += len(item)
        yield pcm_bytes


async def generate_audio_nonstreaming(voice_id: str, text: str, fmt: str):
    logger.info(f"Non-streaming: voice_id={voice_id}, text={text[:30]}...")
    model = load_model()
    voice_id, items = _get_voice_items(voice_id)

    logger.info("Generating complete audio (non-streaming mode)...")
    try:
        with _model_lock:
            wavs, sr = model.generate_voice_clone(
                text=text,
                language="Auto",
                voice_clone_prompt=items,
            )
        audio = tensor_to_numpy(wavs[0])
        logger.info(f"Complete audio generated! Length: {len(audio)} samples")
        return to_pcm16(audio)
    except Exception as exc:
        logger.error(f"Generation error: {exc}")
        raise


@app.post("/v1/audio/speech")
async def create_speech(req: SpeechRequest):
    if _model is None:
        if _model_load_error:
            raise HTTPException(status_code=503, detail=f"Model not loaded: {_model_load_error}")
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not req.input.strip():
        raise HTTPException(status_code=400, detail="'input' text is empty")

    voice_id = req.voice
    if not voice_id or voice_id == "alloy":
        voice_id = DEFAULT_VOICE_ID
        logger.info(f"Using default voice: {voice_id}")

    fmt = req.response_format.lower()
    _CONTENT_TYPES = {"wav": "audio/wav", "pcm": "audio/pcm"}

    if fmt == "mp3":
        logger.warning("MP3 not supported, converting to WAV")
        fmt = "wav"
    if fmt not in _CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"response_format {fmt!r} not supported. Use: wav, pcm")
    content_type = _CONTENT_TYPES[fmt]

    try:
        current_mode = get_mode()

        if current_mode:
            logger.info("Using STREAMING mode")
            async def audio_stream():
                if fmt == "wav":
                    logger.info("Sending WAV header (streaming mode)...")
                    yield wav_header_streaming(SAMPLE_RATE)
                    await asyncio.sleep(0)
                chunk_count = 0
                async for chunk in stream_audio(voice_id, req.input, fmt):
                    chunk_count += 1
                    yield chunk
                    await asyncio.sleep(0)
                logger.info(f"Streaming complete! {chunk_count} chunks sent")

            return StreamingResponse(
                audio_stream(),
                media_type=content_type,
                status_code=200,
                headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
            )
        else:
            logger.info("Using NON-STREAMING mode")
            pcm_bytes = await generate_audio_nonstreaming(voice_id, req.input, fmt)
            if fmt == "wav":
                return Response(content=wav_header(SAMPLE_RATE, len(pcm_bytes)) + pcm_bytes, media_type=content_type)
            else:
                return Response(content=pcm_bytes, media_type=content_type)

    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── CLI args & console listener ───────────────────────────────────

def _parse_args():
    p = argparse.ArgumentParser(description="Qwen3-TTS API Server (Unified)")
    p.add_argument("--voice-id", "-v", default=DEFAULT_VOICE_ID,
                   help=f"Default voice ID to use (default: {DEFAULT_VOICE_ID})")
    p.add_argument("--port", "-p", type=int, default=8088,
                   help="API server port (default: 8088)")
    p.add_argument("--host", default="0.0.0.0",
                   help="Bind host (default: 0.0.0.0)")
    p.add_argument("--preload", action="store_true", default=True,
                   help="Preload model at startup (default: True)")
    p.add_argument("--mode", choices=["streaming", "non-streaming"], default="streaming",
                   help="Initial mode: streaming or non-streaming (default: streaming)")
    return p.parse_args()


def mode_switch_listener():
    """Listen for commands in terminal: mode, status, sizeN and cpu, gpu."""
    while True:
        try:
            user_input = input().strip().lower()
            if user_input == "mode":
                new_mode = toggle_mode()
                print(f"\n[Mode switched to: {'STREAMING' if new_mode else 'NON-STREAMING'}]\n")
            elif user_input == "status":
                mode = get_mode()
                chunk = get_chunk_size()
                with DEVICE_LOCK:
                    current_force_cpu = FORCE_CPU
                device = "CPU (forced)" if current_force_cpu else ("GPU (CUDA)" if torch.cuda.is_available() else "CPU")
                if not torch.cuda.is_available() and not current_force_cpu:
                    device += " (CUDA not detected)"
                print(f"\n[Current mode: {'STREAMING' if mode else 'NON-STREAMING'}, Chunk size: {chunk}, Device: {device}]\n")
            elif user_input.startswith("size") and user_input[4:].isdigit():
                new_size = int(user_input[4:])
                set_chunk_size(new_size)
                print(f"\n[Chunk size set to: {new_size}. Will be used in streaming mode]\n")
            elif user_input.startswith("size"):
                print(f"\n[Invalid size format. Use: sizeN (e.g., size8)]\n")
            elif user_input == "cpu":
                with DEVICE_LOCK:
                    if FORCE_CPU:
                        print(f"\n[Already in CPU mode]\n")
                        continue
                    if not torch.cuda.is_available():
                        print(f"\n[CUDA not available, already using CPU mode]\n")
                        continue
                    FORCE_CPU = True
                unload_model()
                print(f"\n[Switched to CPU mode]")
                print(f"[INFO] Model will reload in CPU mode on next request\n")
            elif user_input == "gpu":
                with DEVICE_LOCK:
                    if not torch.cuda.is_available():
                        print(f"\n[CUDA not available. Cannot switch to GPU mode]\n")
                        print(f"[INFO] Please check your NVIDIA driver and CUDA installation\n")
                        continue
                    if not FORCE_CPU:
                        print(f"\n[Already in GPU mode]\n")
                        continue
                    FORCE_CPU = False
                unload_model()
                print(f"\n[Switched to GPU mode]")
                print(f"[INFO] Model will reload in GPU mode on next request\n")
            elif user_input in ["quit", "exit"]:
                print("\n[Use Ctrl+C to stop the server]\n")
            else:
                if user_input:
                    print(f"\n[Unknown command: {user_input}. Commands: 'mode', 'status', 'sizeN', 'cpu', 'gpu']\n")
        except EOFError:
            break
        except Exception as e:
            logger.error(f"Mode switch listener error: {e}")
            break


if __name__ == "__main__":
    args = _parse_args()
    DEFAULT_VOICE_ID = args.voice_id

    with MODE_LOCK:
        STREAMING_MODE = (args.mode == "streaming")

    logger.info(f"Default voice: {DEFAULT_VOICE_ID}")
    logger.info(f"Server will listen on http://{args.host}:{args.port}")
    logger.info(f"Initial mode: {'STREAMING' if get_mode() else 'NON-STREAMING'}")
    logger.info("=" * 50)
    logger.info("Type 'mode' + Enter in terminal to switch mode")
    logger.info("Type 'status' + Enter to check current mode")
    logger.info("=" * 50)

    if args.preload:
        logger.info("Preloading model at startup...")
        try:
            load_model()
            logger.info("Model preloaded successfully")
        except Exception as e:
            logger.error(f"Model preload failed: {e}")

    mode_thread = threading.Thread(target=mode_switch_listener, daemon=True)
    mode_thread.start()

    uvicorn.run(app, host=args.host, port=args.port)
