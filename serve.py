"""Tiny static server for the BiliLIST prototype.

Plain `python -m http.server` lets the browser cache app.js / styles.css, so
edits do not show up until you hard-refresh. This version sends no-store
headers, which makes every reload pick up your latest changes.

    python serve.py            # http://127.0.0.1:8123/
    python serve.py 9000       # pick another port
"""

import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadedServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        print("BiliLIST prototype running at http://127.0.0.1:%d/" % PORT)
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
