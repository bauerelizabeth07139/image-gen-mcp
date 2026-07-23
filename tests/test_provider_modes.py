from __future__ import annotations
import http.server
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import server


def post_json(url: str, payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def start_server() -> str:
    import importlib
    importlib.reload(server)
    started = []

    def target():
        server.main()

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    for _ in range(40):
        time.sleep(0.1)
        if started:
            break
    time.sleep(0.6)
    return started[0] if started else os.environ.get("IMAGE_GEN_LAST_URL", "")


class UpstreamCapture(http.server.BaseHTTPRequestHandler):
    captured = None

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        UpstreamCapture.captured = body
        payload = json.dumps({"ok": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        return


def start_fake_upstream() -> tuple[str, http.server.HTTPServer]:
    srv = http.server.HTTPServer(("127.0.0.1", 0), UpstreamCapture)
    host, port = srv.server_address
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://{host}:{port}", srv


def run_case(provider: str, args: dict) -> tuple[int, dict, dict]:
    up_url, up_srv = start_fake_upstream()
    try:
        os.environ["IMAGE_GEN_PROVIDER"] = provider
        os.environ["IMAGE_GEN_BASE_URL"] = up_url
        os.environ["IMAGE_GEN_API_KEY"] = "test-key"
        os.environ["IMAGE_GEN_TIMEOUT_MS"] = "2000"
        UpstreamCapture.captured = None
        base = start_server()
        if not base:
            raise RuntimeError("server url not captured")
        status, body = post_json(f"{base}/call-tool", {"tool": "image_generate", "args": args})
        return status, body, UpstreamCapture.captured or {}
    finally:
        up_srv.shutdown()


def main() -> int:
    ok = True

    status, body, captured = run_case("openai", {"prompt": "cat", "size": "512x512", "n": 5, "response_format": "url"})
    ok = ok and status == 200 and body.get("provider") == "openai" and captured.get("model") == "dall-e-3" and captured.get("n") == 1 and captured.get("response_format") == "b64_json" and captured.get("size") == "512x512"

    status2, body2, captured2 = run_case("generic", {"prompt": "cat", "size": "768x768", "n": 2, "response_format": "url"})
    ok = ok and status2 == 200 and body2.get("provider") == "generic" and captured2.get("model") == "gpt-image-1" and captured2.get("n") == 2 and captured2.get("response_format") == "url" and captured2.get("size") == "768x768"

    print(json.dumps({
        "openai_case": {"status": status, "body": body, "captured": captured},
        "generic_case": {"status": status2, "body": body2, "captured": captured2},
    }, indent=2, ensure_ascii=False))
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
