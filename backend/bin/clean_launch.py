import env_setup  # noqa: F401 - sets up PATH, sys.path, offline mode, SSL patch

import os
import sys
import warnings
import asyncio
import logging
import webbrowser
import time
import socket

warnings.filterwarnings("ignore")


def silent_exception_handler(loop, context):
    exception = context.get('exception')
    message = context.get('message', '')
    if isinstance(exception, ConnectionResetError) or "10054" in str(exception):
        return
    if "_call_connection_lost" in message or "ProactorBasePipeTransport" in message:
        return
    loop.default_exception_handler(context)


def auto_open_browser(ip, port):
    url = f"https://{ip}:{port}"
    print(f"[系统] 正在等待引擎加载，完成后将自动弹出网页...")
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(1)
            if sock.connect_ex((ip, int(port))) == 0:
                break
        time.sleep(1)
    time.sleep(2)
    print(f"[系统] 服务就绪，正在打开浏览器...")
    webbrowser.open(url)


def find_available_port(start_port=7860, max_tries=50):
    for port in range(start_port, start_port + max_tries):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(('127.0.0.1', port))
                return str(port)
        except OSError:
            continue
    return str(start_port + 100)


def start_app():
    ip = "127.0.0.1"
    port = os.environ.get("GRADIO_SERVER_PORT", "7860")
    if port == "7860":
        port = find_available_port(7860)
        print(f"[INFO] 自动选择端口: {port}")
    for i, arg in enumerate(sys.argv):
        if arg == "--ip":
            ip = sys.argv[i + 1]
        if arg == "--port":
            port = sys.argv[i + 1]

    import threading
    threading.Thread(target=auto_open_browser, args=(ip, port), daemon=True).start()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.set_exception_handler(silent_exception_handler)

    try:
        import integrated_app
        integrated_app.run_integrated(ip, port)
    except Exception as e:
        import traceback
        print("\n[ERROR] 致命错误详情:")
        traceback.print_exc()
        input("\n按任意键退出...")


if __name__ == "__main__":
    logging.getLogger('asyncio').setLevel(logging.CRITICAL)
    os.system("")
    start_app()
