#!/usr/bin/env python3
"""Local static server with Range support for /audio/*."""

from __future__ import annotations

import argparse
import mimetypes
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

mimetypes.add_type("audio/mp4", ".m4a")

ROOT = Path(__file__).resolve().parent
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        self.send_header(
            "Access-Control-Expose-Headers",
            "Content-Range, Accept-Ranges, Content-Length",
        )
        path = urlparse(self.path).path
        if path.startswith("/audio/"):
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self._serve_audio_range():
            return
        super().do_GET()

    def do_HEAD(self):
        if self._serve_audio_range(head_only=True):
            return
        super().do_HEAD()

    def _serve_audio_range(self, head_only: bool = False) -> bool:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/audio/"):
            return False

        rel = unquote(parsed.path.lstrip("/"))
        file_path = (ROOT / rel).resolve()
        try:
            file_path.relative_to(ROOT.resolve())
        except ValueError:
            self.send_error(403, "Forbidden")
            return True
        if not file_path.is_file():
            return False

        file_size = file_path.stat().st_size
        content_type = self.guess_type(str(file_path))
        range_header = self.headers.get("Range")

        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            if not head_only:
                with file_path.open("rb") as f:
                    self.wfile.write(f.read())
            return True

        match = RANGE_RE.match(range_header.strip())
        if not match:
            self.send_error(400, "Invalid Range")
            return True
        start_s, end_s = match.group(1), match.group(2)
        start = int(start_s) if start_s else 0
        end = int(end_s) if end_s else file_size - 1
        if start >= file_size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return True
        end = min(end, file_size - 1)
        length = end - start + 1

        self.send_response(206)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        if not head_only:
            with file_path.open("rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(64 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "5188")))
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Serving {ROOT} at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
