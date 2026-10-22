"""Tiny loopback receiver used once to pull the PSAI CPI workbook out of the
browser (psa.gov.ph is behind Cloudflare, so only a real browser can fetch it).

    python tools/receive.py 8124

Then, from a page on psa.gov.ph, POST the file to http://127.0.0.1:8124/upload
and it is written to tools/_download/<name>.
"""

import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_download")


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        name = self.path.strip("/").replace("/", "_") or "upload.bin"
        os.makedirs(OUT, exist_ok=True)
        target = os.path.join(OUT, name)
        with open(target, "wb") as fh:
            fh.write(self.rfile.read(length))
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, fmt, *args):
        pass


class Threaded(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Threaded(("127.0.0.1", PORT), Handler) as httpd:
        print("receiving on http://127.0.0.1:%d/upload -> %s" % (PORT, OUT))
        httpd.serve_forever()
