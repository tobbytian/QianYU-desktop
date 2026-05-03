# AGENTS.md — QianYU Desktop

## Architecture

- **Tauri v2** desktop app (Windows-only). React/TypeScript frontend + Rust backend + Python FastAPI sidecar.
- **Python TTS server** runs on `127.0.0.1:8088`. In dev it's started by `dev.bat`; in prod it's packaged as a sidecar binary.
- **Bundled Python**: `backend/WPy64-312101/` is a full WinPython64 distribution (not a venv).
- **Models** live in `backend/models/` (gitignored, large files).

## Dev commands

```bash
# Full dev mode (starts Python server + Tauri):
dev.bat

# Stop everything:
stop.bat

# Frontend-only Vite server (port 1421):
npm run dev

# Tauri dev (also runs `npm run dev` first):
npm run tauri dev

# TypeScript check + build:
npm run build

# Tauri production build:
npm run tauri build
```

## API flow

The frontend (`src/services/api.ts`) calls the Python server **directly** via `fetch` to `http://127.0.0.1:8088`. It does **not** go through Tauri commands for TTS operations. Only file dialogs and file save use `@tauri-apps/api/core` `invoke()`.

The Rust backend (`src-tauri/src/lib.rs`) exposes Tauri commands that also proxy to the Python server, but the current frontend bypasses those for API calls.

## Path alias

`@/` → `src/` (defined in both `vite.config.ts` and `tsconfig.json`).

## Key constraints

- **`tsconfig.json` strict mode** with `noUnusedLocals: true` and `noUnusedParameters: true`. Any unused imports or params will fail `npm run build`.
- **Offline mode** enforced in `server.py`: `TRANSFORMERS_OFFLINE=1`, `HF_HUB_OFFLINE=1`, `MODELSCOPE_OFFLINE=1`.
- **The `scripts/` directory** referenced in `README.md` does not exist. `server.py` is at repo root.
- **Tailwind** with a custom `primary` color palette and a `pulse-slow` animation.
- **UI is Chinese-language**. All labels and messages use Simplified Chinese.
- **WAV encoding** is duplicated: frontend `useTTS.ts` does it for playback, Rust `lib.rs` does it for file save. Both use the same f32→i16 conversion logic. Keep them in sync.
- **No lint/prettier config** in the repo. There is no separate lint or format step.
