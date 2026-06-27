import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const controlClass =
  "flex h-9 w-11 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400";

export function WindowControls() {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    appWindow.isMaximized().then(setIsMaximized).catch(() => undefined);
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    }).then((handler) => {
      unlisten = handler;
    }).catch(() => undefined);

    return () => unlisten?.();
  }, [appWindow]);

  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };

  const handleClose = async () => {
    await appWindow.close();
  };

  return (
    <div className="isolate overflow-hidden flex items-center gap-1">
      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={handleMinimize}
        className={controlClass}
        aria-label="最小化窗口"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={handleMaximize}
        className={controlClass}
        aria-label={isMaximized ? "还原窗口" : "最大化窗口"}
      >
        {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={handleClose}
        className="flex h-9 w-11 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400"
        aria-label="关闭窗口"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
