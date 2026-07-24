<p align="center">
  <img src="./assets/logo.png" width="120" alt="Image Generation MCP"/>
</p>

<h1 align="center">🎨 Image Generation MCP</h1>

<p align="center">
  <strong>Configurable · Provider-Agnostic · Drop-in MCP Server</strong><br/>
  A Codex plugin that exposes image generation tools through MCP with configurable base URL and API key.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.2.0-blue" alt="Version"/>
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

Forwards requests as-is to `{BASE_URL}/v1/images/generations` with your payload.

**Use when:** Your API endpoint already follows the OpenAI-compatible format.

### `openai`

Normalizes requests to the strict OpenAI Images API shape:
- Forces `model` → `dall-e-3` (unless overridden)
- Forces `n` → `1`
- Forces `response_format` → `b64_json`

**Use when:** You're calling the real OpenAI API and need strict format compliance.

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

**Returns:** Base64-encoded image data or actionable error.

### `image_config_status`

Check whether the required configuration is in place.

```json
{
  "tool": "image_config_status",
  "args": {}
}
```

**Returns:** Current provider, base URL presence, API key presence.

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
│               {BASE_URL}/v1/images/         │
│                   generations               │
└─────────────────────────────────────────────┘
```

---

## 📁 Structure

```
image-gen-mcp/
├── .codex-plugin/
│   └── plugin.json              # Plugin manifest
├── .mcp.json                    # MCP server config
├── assets/
│   ├── composer-icon.png        # Composer icon
│   └── logo.png                 # Plugin logo
├── skills/
│   └── image-generation/
│       ├── SKILL.md             # Skill instructions
│       ├── agents/
│       │   └── openai.yaml      # UI metadata
│       └── assets/
│           └── image-generation-small.svg
├── scripts/
│   ├── server.mjs               # Node.js MCP server
│   ├── server.py                # Python HTTP server (testing)
│   ├── test_server.py           # Smoke test
│   └── validate_plugin.py       # Plugin validator
├── tests/
│   └── test_provider_modes.py   # Provider regression tests
├── LICENSE
└── README.md
```

---

## 🧪 Validate & Test

### Plugin Validation

```bash
python scripts/validate_plugin.py .
```

### Provider Mode Tests

```bash
python tests/test_provider_modes.py
```

### Smoke Test

```bash
$env:IMAGE_GEN_API_KEY="test-key"
$env:IMAGE_GEN_BASE_URL="http://localhost"
python scripts/test_server.py
```

---

## 📜 License

MIT

---

<p align="center">
  <sub>Built for <a href="https://github.com/openai/codex">Codex</a> · Powered by MCP</sub>
</p>
