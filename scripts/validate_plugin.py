from __future__ import annotations
import json
from pathlib import Path
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/validate_plugin.py <plugin-folder>")
        return 2
    root = Path(sys.argv[1])
    errors: list[str] = []

    manifest = root / ".codex-plugin" / "plugin.json"
    if not manifest.exists():
        errors.append("Missing .codex-plugin/plugin.json")
    else:
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except Exception as exc:
            data = None
            errors.append(f"plugin.json is invalid JSON: {exc}")
        if isinstance(data, dict):
            for key in ["name", "version", "description", "author", "interface"]:
                if key not in data:
                    errors.append(f"plugin.json missing field: {key}")
            interface = data.get("interface") or {}
            for field in ["displayName", "shortDescription", "longDescription", "developerName", "category"]:
                if field not in interface:
                    errors.append(f"interface missing field: {field}")
            if "[TODO:" in json.dumps(data):
                errors.append("plugin.json contains TODO placeholder")

    mcp = root / ".mcp.json"
    if not mcp.exists():
        errors.append("Missing .mcp.json")
    else:
        try:
            json.loads(mcp.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f".mcp.json is invalid JSON: {exc}")

    skill = root / "skills" / "image-generation" / "SKILL.md"
    if not skill.exists():
        errors.append("Missing skills/image-generation/SKILL.md")

    if errors:
        print("VALIDATION FAILED")
        for err in errors:
            print(f"- {err}")
        return 1

    print("VALIDATION OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
