"""Tiny static server for the BiliLIST prototype.

Plain `python -m http.server` lets the browser cache app.js / styles.css, so
edits do not show up until you hard-refresh. This version sends no-store
headers, which makes every reload pick up your latest changes.

    python serve.py                 # http://127.0.0.1:8123/  (this PC only)
    python serve.py 9000            # pick another port
    python serve.py 8123 0.0.0.0    # optional LAN dev only; not the demo path

This server is for local development. The website itself is static, and the
public GitHub Pages URL (see DEPLOY.md) is what groupmates and phones should
open, because it works on any internet connection.
"""

import http.server
import socket
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
HOST = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"


def lan_addresses():
    """Every non-loopback IPv4 address, so you can type one into a phone."""
    found = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in found:
                found.append(ip)
    except OSError:
        pass
    return found


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
    with ThreadedServer((HOST, PORT), NoCacheHandler) as httpd:
        print("BiliLIST prototype running at http://127.0.0.1:%d/" % PORT)
        if HOST in ("0.0.0.0", "::"):
            for ip in lan_addresses():
                print("  LAN dev only:   http://%s:%d/" % (ip, PORT))
            print("  (same-Wi-Fi development only; for the demo and groupmates")
            print("   use the public GitHub Pages URL from DEPLOY.md instead)")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
