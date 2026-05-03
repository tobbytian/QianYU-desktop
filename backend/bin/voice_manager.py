"""Voice registry management - shared between API server and WebUI."""
import os
import json
import torch
from pathlib import Path

from env_setup import PROJECT_ROOT

SAVED_VOICES_DIR = os.path.join(PROJECT_ROOT, "saved_voices")
VOICE_REGISTRY_FILE = os.path.join(SAVED_VOICES_DIR, "voice_registry.json")
VOICE_CACHE = {}


def ensure_voices_dir():
    Path(SAVED_VOICES_DIR).mkdir(parents=True, exist_ok=True)


def get_voice_registry():
    ensure_voices_dir()
    if os.path.exists(VOICE_REGISTRY_FILE):
        with open(VOICE_REGISTRY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"voices": []}


def save_voice_registry(registry):
    ensure_voices_dir()
    with open(VOICE_REGISTRY_FILE, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)


def get_next_voice_id():
    registry = get_voice_registry()
    existing_ids = [v["id"] for v in registry.get("voices", [])]
    if not existing_ids:
        return "voice_001"
    nums = []
    for vid in existing_ids:
        try:
            nums.append(int(vid.split("_")[1]))
        except (ValueError, IndexError):
            pass
    next_num = max(nums) + 1 if nums else 1
    return f"voice_{next_num:03d}"


def get_saved_voices():
    registry = get_voice_registry()
    voices = []
    for v in registry.get("voices", []):
        voices.append({
            "id": v["id"],
            "name": v["name"],
            "created_at": v.get("created_at", ""),
        })
    return voices


def load_voice(voice_id):
    voice_file = os.path.join(SAVED_VOICES_DIR, f"{voice_id}.pt")
    if not os.path.exists(voice_file):
        return None
    payload = torch.load(voice_file, map_location="cpu", weights_only=False)
    return payload


def parse_voice_items(payload):
    from qwen_tts.inference.qwen3_tts_model import VoiceClonePromptItem
    items = []
    for d in payload.get("items", []):
        ref_code = d.get("ref_code")
        if ref_code is not None and not torch.is_tensor(ref_code):
            ref_code = torch.tensor(ref_code)

        ref_spk = d.get("ref_spk_embedding")
        if ref_spk is not None and not torch.is_tensor(ref_spk):
            ref_spk = torch.tensor(ref_spk)

        item = VoiceClonePromptItem(
            ref_code=ref_code,
            ref_spk_embedding=ref_spk,
            x_vector_only_mode=d.get("x_vector_only_mode", False),
            icl_mode=d.get("icl_mode", False),
            ref_text=d.get("ref_text")
        )
        items.append(item)
    return items
