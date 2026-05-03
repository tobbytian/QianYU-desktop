"""Model management utilities - shared between API server and WebUI."""
import gc
import logging
import torch

logger = logging.getLogger(__name__)


def detect_device(force_cpu=False):
    """Detect best available device and return config.

    Args:
        force_cpu: If True, force CPU mode regardless of CUDA availability.

    Returns:
        (device, compute_dtype, attn_mode, use_cuda)
    """
    if force_cpu:
        logger.info("Forced CPU mode by user setting")
        return "cpu", torch.float32, "sdpa", False

    use_cuda = torch.cuda.is_available()
    if not use_cuda:
        logger.warning("No CUDA detected, using CPU mode (slower)")
        return "cpu", torch.float32, "sdpa", False

    compute_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    attn_mode = "flash_attention_2"
    try:
        import flash_attn  # noqa: F401
        logger.info("Flash-Attention detected, using high performance mode")
    except ImportError:
        attn_mode = "sdpa"
        logger.info("Using standard SDPA mode")

    logger.info("Using GPU mode (CUDA)")
    return "cuda", compute_dtype, attn_mode, True


def unload_model(model_ref, model_name="model"):
    """Unload a model and free GPU memory.

    Args:
        model_ref: The model object to unload (can be None).
        model_name: Name for logging purposes.

    Returns:
        None (always returns None to signal model is unloaded).
    """
    if model_ref is not None:
        logger.info(f"Unloading {model_name}...")
        try:
            del model_ref
        except Exception as e:
            logger.error(f"Error unloading {model_name}: {e}")
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info(f"{model_name} unloaded successfully")
    return None
