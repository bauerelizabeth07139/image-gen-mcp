# Image Generation MCP

A Codex plugin and MCP server for image generation with configurable base URL, API key, and provider mode.

## Features

- Configurable `IMAGE_GEN_BASE_URL` and `IMAGE_GEN_API_KEY`
- Two provider modes: `generic` and `openai`
- `openai` mode auto-normalizes to the OpenAI Images API shape (`dall-e-3`, `n=1`, `b64_json`)
- Health check, config status, and generation endpoints
- Works as a local Codex plugin with marketplace install

## Install

### As a Codex plugin

```bash
# 1. Add your personal marketplace pointing at this repo
# 2. Install:
codex plugin add image-gen-mcp@personal
```

### From source

```bash
git clone <this-repo>
cd image-gen-mcp
```

## Configure

| Variable | Required | Default | Description |
|---|---|---|---|
| `IMAGE_GEN_BASE_URL` | Yes | - | Base URL of the image generation API |
| `IMAGE_GEN_API_KEY` | Yes | - | API key for authentication |
| `IMAGE_GEN_PROVIDER` | No | `generic` | `generic` or `openai` |
| `IMAGE_GEN_DEFAULT_MODEL` | No | `gpt-image-1` / `dall-e-3` | Default model id |
| `IMAGE_GEN_TIMEOUT_MS` | No | `30000` | Request timeout in ms |

## Provider Modes

### `generic` (default)

Forwards requests as-is to `{BASE_URL}/v1/images/generations` with the caller's payload.

### `openai`

Normalizes requests to the OpenAI Images API shape:
- Forces `model` to `dall-e-3` unless overridden
- Forces `n=1`
- Forces `response_format=b64_json`

## Validate

```bash
python scripts/validate_plugin.py .
```

## Test

```bash
# Provider-mode regression tests
python tests/test_provider_modes.py

# Original smoke test
$env:IMAGE_GEN_API_KEY="test-key"; $env:IMAGE_GEN_BASE_URL="http://localhost"; python scripts/test_server.py
```

## Structure

```
image-gen-mcp/
  .codex-plugin/plugin.json   # Plugin manifest
  .mcp.json                   # MCP server config
  skills/image-generation/    # Companion skill
  scripts/server.mjs          # Node.js MCP server
  scripts/server.py           # Python HTTP server (for testing)
  scripts/test_server.py      # Smoke test
  scripts/validate_plugin.py  # Plugin validator
  tests/test_provider_modes.py # Provider regression tests
```

## API

### `GET /health`

Returns configuration status.

### `POST /call-tool`

#### `image_config_status`

Returns current provider, base URL, and API key configuration.

#### `image_generate`

Generates an image from a prompt.

```json
{
  "tool": "image_generate",
  "args": {
    "prompt": "a cat in space",
    "size": "1024x1024",
    "model": "dall-e-3"
  }
}
```

## License

MIT
