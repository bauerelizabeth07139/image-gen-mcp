<p align="center">
  <img src="./assets/logo.svg" width="120" alt="Image Generation MCP"/>
</p>

<h1 align="center">🎨 Image Generation MCP</h1>

<p align="center">
  <strong>Configurable · Provider-Agnostic · Drop-in MCP Server</strong><br/>
  A Codex plugin that exposes image generation tools through MCP with configurable base URL and API key.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.3.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License"/>
  <img src="https://img.shields.io/badge/MCP-Server-orange" alt="MCP Server"/>
  <img src="https://img.shields.io/badge/Platform-Codex-black" alt="Platform"/>
</p>

---

## ✨ Features

- 🔧 **Fully Configurable** — Set your own API endpoint and key via environment variables
- 🔄 **Two Provider Modes** — `generic` for any compatible API, `openai` for OpenAI Images API
- 🛠️ **Two Built-in Tools** — `image_generate` and `image_config_status`
- 📦 **Drop-in Plugin** — Install from personal marketplace, works out of the box
- 🎯 **Minimal Context** — Pure MCP tool layer, no planner/workflow overhead

---

## 📖 What It Does

Image Generation MCP is a **proxy server** that sits between Codex and any image generation API (OpenAI DALL-E, Stable Diffusion endpoints, custom APIs, etc.). When Codex needs to generate an image, it calls the MCP tools exposed by this plugin, which forwards the request to your configured backend.

### Core Functionality

| Function | Description |
|----------|-------------|
| **Image Generation** | Accepts a text prompt and returns a generated image (base64-encoded) via `image_generate` |
| **Config Check** | Verifies that the API endpoint and key are properly configured via `image_config_status` |
| **Provider Abstraction** | Translates requests between Codex's tool format and the upstream API format |
| **Format Normalization** | In `openai` mode, automatically enforces correct OpenAI API parameters (model, n, response_format) |

### How It Works

1. Codex calls `image_generate` with a prompt and optional parameters
2. The MCP server builds a payload based on the selected provider mode
3. The request is forwarded to `${BASE_URL}/v1/images/generations`
4. The response (image data or error) is returned to Codex

---

## 🚀 Quick Start

### 1. Install from Personal Marketplace

```bash
codex plugin add image-gen-mcp@personal
```

### 2. Set Environment Variables

```bash
export IMAGE_GEN_BASE_URL="https://your-api-endpoint.com"
export IMAGE_GEN_API_KEY="your-api-key"
export IMAGE_GEN_PROVIDER="generic"         # or "openai"
export IMAGE_GEN_DEFAULT_MODEL="dall-e-3"   # optional
export IMAGE_GEN_TIMEOUT_MS="30000"         # optional
```

### 3. Use It

Once installed, the plugin exposes these MCP tools automatically:

- `image_generate` — Generate an image from a text prompt
- `image_config_status` — Check if base URL and API key are configured

---

## ⚙️ Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IMAGE_GEN_BASE_URL` | ✅ | — | Base URL of the image generation API |
| `IMAGE_GEN_API_KEY` | ✅ | — | API key for authentication |
| `IMAGE_GEN_PROVIDER` | | `generic` | `generic` or `openai` |
| `IMAGE_GEN_DEFAULT_MODEL` | | `dall-e-3` | Default model ID |
| `IMAGE_GEN_TIMEOUT_MS` | | `30000` | Request timeout in milliseconds |

---

## 🔄 Provider Modes

### `generic` (Default)

Forwards requests as-is to `${BASE_URL}/v1/images/generations` with your payload.

**Use when:** Your API endpoint already follows the OpenAI-compatible format.

**Behavior:** Passes `model`, `prompt`, `size`, `n`, `response_format` directly to the upstream API without modification.

### `openai`

Normalizes requests to the strict OpenAI Images API shape:
- Forces `model` → `dall-e-3` (unless overridden)
- Forces `n` → `1`
- Forces `response_format` → `b64_json`

**Use when:** You're calling the real OpenAI API and need strict format compliance.

**Behavior:** Ignores user-supplied `n` and `response_format` to prevent API errors.

---

## 🛠️ Tools Reference

### `image_generate`

Generate an image from a text prompt.

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

**Parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `prompt` | ✅ | — | Text description of the image to generate |
| `size` | | `1024x1024` | Image dimensions (e.g., `256x256`, `512x512`, `1024x1024`) |
| `model` | | `dall-e-3` | Model ID to use for generation |
| `n` | | `1` | Number of images (generic mode only; forced to 1 in openai mode) |
| `response_format` | | `b64_json` | Response format (generic mode only; forced to `b64_json` in openai mode) |

**Returns:** Base64-encoded image data or actionable error.

### `image_config_status`

Check whether the required configuration is in place.

```json
{
  "tool": "image_config_status",
  "args": {}
}
```

**Returns:**

```json
{
  "ok": true,
  "configuredBaseUrl": true,
  "configuredApiKey": true,
  "defaultModel": "dall-e-3",
  "provider": "openai",
  "missing": []
}
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│                  Codex                       │
│                                             │
│   User Prompt ──→ Image Generation Skill    │
│                        │                    │
│                        ▼                    │
│               MCP Server (Node.js)          │
│               scripts/server.mjs            │
│                        │                    │
│              ┌─────────┴─────────┐          │
│              ▼                   ▼          │
│       generic mode          openai mode     │
│              │                   │          │
│              └─────────┬─────────┘          │
│                        ▼                    │
│               ${BASE_URL}/v1/images/        │
│                   generations               │
└─────────────────────────────────────────────┘
```

---

## 📁 Structure

```
image-gen-mcp/
├── .codex-plugin/
│   └── plugin.json              # Plugin manifest (name, version, interface metadata)
├── .mcp.json                    # MCP server config (tells Codex how to launch the server)
├── assets/
│   ├── composer-icon.png        # Composer UI icon
│   ├── logo.png                 # Plugin logo (raster)
│   └── logo.svg                 # Plugin logo (vector)
├── skills/
│   └── image-generation/
│       ├── SKILL.md             # Skill instructions for Codex
│       ├── agents/
│       │   └── openai.yaml      # UI metadata (display name, icon, default prompt)
│       └── assets/
│           └── image-generation-small.svg
├── scripts/
│   ├── server.mjs               # Node.js MCP server (primary, used by .mcp.json)
│   ├── server.py                # Python HTTP server (for testing/debugging)
│   ├── test_server.py           # Smoke test (health, config, missing args, upstream)
│   └── validate_plugin.py       # Plugin structure validator
├── tests/
│   └── test_provider_modes.py   # Provider mode regression tests (openai vs generic)
├── LICENSE                      # MIT license
└── README.md                    # This file
```

---

## 🧪 Validate & Test

### Plugin Validation

Checks that `plugin.json`, `.mcp.json`, and `SKILL.md` all exist and are valid:

```bash
python scripts/validate_plugin.py .
```

### Provider Mode Tests

Spins up a fake upstream server and verifies that both provider modes produce the correct request payload:

```bash
python tests/test_provider_modes.py
```

### Smoke Test

Starts the Python HTTP server and tests all endpoints (health, config status, missing prompt, upstream error):

```bash
python scripts/test_server.py
```

> **Note:** The smoke test auto-sets `IMAGE_GEN_BASE_URL` and `IMAGE_GEN_API_KEY` defaults if not already configured.

---

## 📜 License

MIT

---

<p align="center">
  <sub>Built for <a href="https://github.com/openai/codex">Codex</a> · Powered by MCP</sub>
</p>
