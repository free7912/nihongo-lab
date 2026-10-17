#!/usr/bin/env python3
"""零依赖本地预览服务器（禁用缓存，改完代码刷新即可看到效果）。

用法：
    cd nihongo-lab
    python tools/serve.py          # 默认 http://127.0.0.1:8000
    python tools/serve.py 8123     # 指定端口
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # 用 HTTP/1.1 + keep-alive（浏览器与本地代理隧道都能稳定复用连接）
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving {root} at http://127.0.0.1:{port}  (Ctrl+C 停止)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
