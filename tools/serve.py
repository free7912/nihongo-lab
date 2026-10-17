#!/usr/bin/env python3
"""零依赖本地预览服务器（禁用缓存，改完代码刷新即可看到效果）。

用法：
    cd nihongo-lab
    python tools/serve.py          # 默认 http://127.0.0.1:8000（被占用会自动往后找）
    python tools/serve.py 8123     # 指定端口
    python tools/serve.py --open   # 启动后自动用默认浏览器打开
"""
import functools
import http.server
import os
import socket
import sys
import threading
import webbrowser


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # 用 HTTP/1.1 + keep-alive（浏览器与本地代理隧道都能稳定复用连接）
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def is_free(port):
    """端口是否可绑定。

    注意：探测时**不能**设 SO_REUSEADDR —— 在 Windows 上它允许绑到已被占用的端口，
    会误判为空闲（真服务器再绑上去就抢端口）。
    """
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
        return True


def pick_port(start, tries=20):
    """从 start 开始找一个能监听的端口（只在没显式指定端口时用）。"""
    for port in range(start, start + tries):
        if is_free(port):
            return port
    raise SystemExit(f"{start}–{start + tries - 1} 都被占用了，请指定别的端口。")


def main():
    args = sys.argv[1:]
    want_open = any(a in ("-o", "--open") for a in args)
    given = [a for a in args if a.isdigit()]
    if given:
        port = int(given[0])
        if not is_free(port):
            raise SystemExit(f"端口 {port} 已被占用：换个端口，或不带端口直接运行（会自动挑空闲端口）。")
    else:
        port = pick_port(8000)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        url = f"http://127.0.0.1:{port}/"
        print(f"serving {root} at {url}  (Ctrl+C 停止)", flush=True)
        if want_open:
            # 等服务器真正开始接受连接，再让浏览器去访问
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        httpd.serve_forever()


if __name__ == "__main__":
    main()
