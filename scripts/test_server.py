from __future__ import annotations
import contextlib
import io
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request


def post_json(url: str, payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return resp.status, body
    except urllib.error.HTTPError as exc:
        body = json.loads(exc.read().decode("utf-8"))
        return exc.code, body


# Ensure required env vars have defaults for testing
os.environ.setdefault("IMAGE_GEN_BASE_URL", "http://127.0.0.1:1")
os.environ.setdefault("IMAGE_GEN_API_KEY", "test-key")


def main() -> int:
    import server

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        thread = threading.Thread(target=server.main, daemon=True)
        thread.start()
        time.sleep(0.8)

    printed = buf.getvalue().strip()
    if "IMAGE_GEN_SERVER_URL=" not in printed:
        print(f"server did not print URL. stdout: {printed}", file=sys.stderr)
        return 1

    base = printed.split("IMAGE_GEN_SERVER_URL=", 1)[1].strip()

    health_resp = urllib.request.urlopen(f"{base}/health", timeout=5)
    health_status = health_resp.status
    status_status, status_body = post_json(f"{base}/call-tool", {"tool": "image_config_status"})
    missing_status, missing_body = post_json(f"{base}/call-tool", {"tool": "image_generate", "args": {}})
    upstream_status, upstream_body = post_json(
        f"{base}/call-tool",
        {"tool": "image_generate", "args": {"prompt": "test"}},
    )

    result = {
        "base": base,
        "health_status": health_status,
        "status_status": status_status,
        "status_body": status_body,
        "missing_status": missing_status,
        "missing_body": missing_body,
        "upstream_status": upstream_status,
        "upstream_body": upstream_body,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))

    ok = (
        health_status == 200
        and status_status == 200
        and missing_status == 400
        and upstream_status == 502
    )
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
