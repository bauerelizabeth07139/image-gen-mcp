import http.server
import json
import os
from urllib.request import Request, urlopen


class ImageGenError(Exception):
    pass


def get_provider_config():
    base_url = os.environ.get("IMAGE_GEN_BASE_URL", "").strip()
    api_key = os.environ.get("IMAGE_GEN_API_KEY", "").strip()
    model = os.environ.get("IMAGE_GEN_DEFAULT_MODEL", "").strip()
    timeout_ms = int(os.environ.get("IMAGE_GEN_TIMEOUT_MS", "30000"))
    provider = os.environ.get("IMAGE_GEN_PROVIDER", "generic").strip().lower() or "generic"
    return base_url, api_key, model, timeout_ms, provider


def missing_config():
    base_url, api_key, _, _, _ = get_provider_config()
    missing = []
    if not base_url:
        missing.append("IMAGE_GEN_BASE_URL")
    if not api_key:
        missing.append("IMAGE_GEN_API_KEY")
    return missing


def build_upstream_payload(args: dict, provider: str, default_model: str):
    prompt = (args.get("prompt") or "").strip()
    if provider == "openai":
        return {
            "model": args.get("model") or default_model or "dall-e-3",
            "prompt": prompt,
            "n": 1,
            "size": args.get("size") or "1024x1024",
            "response_format": "b64_json",
        }
    return {
        "model": args.get("model") or default_model or "gpt-image-1",
        "prompt": prompt,
        "size": args.get("size") or "1024x1024",
        "n": args.get("n") or 1,
        "response_format": args.get("response_format") or "b64_json",
    }


def forward_request(payload: dict, base_url: str, api_key: str, timeout_ms: int):
    url = f"{base_url.rstrip('/')}/v1/images/generations"
    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key}")
    try:
        with urlopen(req, timeout=timeout_ms / 1000) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return json.loads(body)
            except Exception:
                return {"raw": body}
    except Exception as exc:
        raise ImageGenError(str(exc)) from exc


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            base_url, api_key, _, _, _ = get_provider_config()
            missing = missing_config()
            self._send(200, {
                "ok": len(missing) == 0,
                "configuredBaseUrl": bool(base_url),
                "configuredApiKey": bool(api_key),
                "missing": missing,
            })
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/call-tool":
            try:
                payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0) or 0)))
            except Exception as exc:
                self._send(400, {"error": f"invalid json: {exc}"})
                return

            tool = payload.get("tool")
            args = payload.get("args") or {}
            if tool == "image_config_status":
                base_url, api_key, model, _, provider = get_provider_config()
                missing = missing_config()
                self._send(200, {
                    "ok": len(missing) == 0,
                    "configuredBaseUrl": bool(base_url),
                    "configuredApiKey": bool(api_key),
                    "defaultModel": model or None,
                    "provider": provider,
                    "missing": missing,
                })
                return

            if tool == "image_generate":
                prompt = (args.get("prompt") or "").strip()
                if not prompt:
                    self._send(400, {"error": "prompt is required"})
                    return
                missing = missing_config()
                if missing:
                    self._send(400, {"error": "missing configuration", "missing": missing})
                    return
                base_url, api_key, model, timeout_ms, provider = get_provider_config()
                upstream_payload = build_upstream_payload(args, provider, model)
                try:
                    upstream = forward_request(upstream_payload, base_url, api_key, timeout_ms)
                    self._send(200, {"ok": True, "provider": provider, "upstream": upstream})
                except ImageGenError as exc:
                    self._send(502, {"error": "upstream request failed", "detail": str(exc)})
                return

            self._send(404, {"error": f"unknown tool: {tool}"})
            return

        self._send(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        return


def main():
    host = os.environ.get("IMAGE_GEN_HOST", "127.0.0.1")
    port = int(os.environ.get("IMAGE_GEN_PORT", "0"))
    srv = http.server.HTTPServer((host, port), Handler)
    actual_port = srv.server_address[1]
    url = f"http://{host}:{actual_port}"
    os.environ["IMAGE_GEN_LAST_URL"] = url
    print(f"IMAGE_GEN_SERVER_URL={url}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
