"""Audio processing utilities - shared between API server and WebUI."""
import io
import os
import struct
import shutil
import subprocess
import tempfile
import numpy as np
import torch


def convert_to_wav(input_path: str) -> str:
    """Convert any audio file to WAV using ffmpeg. Returns path to new WAV temp file.

    If the input is already WAV, returns the original path.
    The caller is responsible for deleting the returned temp file if it differs from input.
    """
    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".wav":
        return input_path

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("ffmpeg not found in PATH - cannot convert audio format")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp.close()
    try:
        subprocess.run(
            [ffmpeg, "-y", "-i", input_path, "-ar", "24000", "-ac", "1", tmp.name],
            capture_output=True, check=True,
        )
        return tmp.name
    except subprocess.CalledProcessError as e:
        os.unlink(tmp.name)
        raise RuntimeError(f"ffmpeg conversion failed: {e.stderr.decode(errors='replace')}")


def tensor_to_numpy(audio):
    """Convert tensor/numpy audio to flattened numpy array (CPU-safe)."""
    if hasattr(audio, 'cpu') and torch.cuda.is_available():
        audio = audio.cpu().numpy()
    elif hasattr(audio, 'numpy'):
        audio = audio.numpy()
    else:
        audio = np.array(audio)
    if hasattr(audio, 'flatten'):
        audio = audio.flatten()
    return audio


def collect_streaming_chunks(generator, chunk_size=None):
    """Collect audio chunks from a streaming generator.

    Args:
        generator: yields (chunk, sample_rate, timing) tuples
        chunk_size: unused, kept for API compatibility

    Returns:
        (numpy_array, sample_rate)
    """
    audio_chunks = []
    sr = 24000
    for chunk, chunk_sr, timing in generator:
        audio_chunks.append(tensor_to_numpy(chunk))
        sr = chunk_sr
    audio = np.concatenate(audio_chunks)
    return audio, sr


def to_pcm16(pcm: np.ndarray) -> bytes:
    """Convert float32 PCM to int16 bytes."""
    return np.clip(pcm * 32768, -32768, 32767).astype(np.int16).tobytes()


def wav_header_streaming(sample_rate: int) -> bytes:
    """WAV header for streaming (unknown data length)."""
    return _build_wav_header(sample_rate, 0xFFFFFFFF)


def wav_header(sample_rate: int, data_len: int = 0xFFFFFFFF) -> bytes:
    """WAV header with known data length."""
    return _build_wav_header(sample_rate, data_len)


def _build_wav_header(sample_rate: int, data_len: int) -> bytes:
    n_channels = 1
    bits = 16
    byte_rate = sample_rate * n_channels * bits // 8
    block_align = n_channels * bits // 8
    riff_size = 0xFFFFFFFF if data_len == 0xFFFFFFFF else 36 + data_len

    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", riff_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, n_channels, sample_rate, byte_rate, block_align, bits))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_len))
    return buf.getvalue()
