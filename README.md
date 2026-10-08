# image-gen-mcp

[![dsh.so risk](https://www.dsh.so/badge/image-gen-mcp.svg)](https://www.dsh.so/artifact/image-gen-mcp/)

**Configurable, provider-agnostic image generation, as a DeepSeek Harness
plugin.** Point it at any OpenAI-compatible `/v1/images/generations` endpoint
and the model gains `image_generate` and `image_config_status` — plus a bundled
skill that tells it when to use them.

*A Codex plugin that exposes image generation tools through MCP with a
configurable base URL and API key.*

## Install

**DeepSeek Harness Desktop** — open **Plugins** in the sidebar, choose **Add
plugin**, and enter:

```
https://github.com/bauerelizabeth07139/image-gen-mcp
```

Then switch the new **dsh-image-gen-mcp** bundle on, and give it a backend (see
[Configuration](#configuration) — without a base URL and key the plugin
deliberately mounts nothing and says so).

**dsh CLI** — install it into the profile you actually boot:

```sh
dsh plugin --profile web add bauerelizabeth07139/image-gen-mcp
```

**No git on the machine?** pnpm resolves a git shorthand with `git ls-remote`,
which fails with `'git' is not recognized` when git is missing. Use the tarball
instead — that path is plain HTTPS:

```sh
dsh plugin --profile web add https://codeload.github.com/bauerelizabeth07139/image-gen-mcp/tar.gz/master
```

The same address works in the Desktop **Add plugin** dialog. Replace `master`
with a commit SHA to pin an exact revision (`/tar.gz/<sha>`).

Uninstall with `dsh plugin --profile web remove dsh-image-gen-mcp`.

## Requirements

- **Node.js ≥ 22** — the harness itself; the server is plain Node with no npm
  dependencies, so there is nothing to install.
- **A backend**: a base URL that answers `POST {baseUrl}/v1/images/generations`
  and an API key for it. The base URL must **not** include `/v1`.

## Tools

| Tool | What it does |
|---|---|
| `mcp__image_generation__image_generate` | Generates an image from a prompt. Parameters: `prompt` (required), `model`, `size`, `n`. |
| `mcp__image_generation__image_config_status` | Reports whether the base URL and key are configured — ask this first when a generation fails for configuration reasons. |

## Bundled skill

`skills/image-generation/SKILL.md` is registered by the plugin, so the model
knows the workflow: check `image_config_status`, generate with
`image_generate`, return the artifact or an actionable error. It is adapted from
the repository's original Codex skill — same workflow, harness tool names, plus
a note about base64 payloads.

## Configuration

| Key | Environment variable | Default | Meaning |
|---|---|---|---|
| `baseUrl` | `IMAGE_GEN_BASE_URL` | *(none — required)* | backend base URL, **without** `/v1` |
| `apiKey` | `IMAGE_GEN_API_KEY` | *(none — required)* | credential for that backend |
| `model` | `IMAGE_GEN_DEFAULT_MODEL` | *(empty)* | default model; the server picks `dall-e-3` in `openai` mode and `gpt-image-1` in `generic` mode when this is empty |
| `provider` | `IMAGE_GEN_PROVIDER` | `generic` | `generic` (URL response) or `openai` (base64 response) |
| `timeoutMs` | `IMAGE_GEN_TIMEOUT_MS` | `30000` | the server's own HTTP budget |
| `toolCallTimeoutMs` | — | `120000` | DSH's per-call budget |
| `env` | — | `{}` | raw environment passthrough |

Example loader row:

```yaml
- id: dsh-image-gen-mcp
  name: 'dsh-image-gen-mcp'
  config:
    baseUrl: 'https://api.example.com'
    apiKey: 'sk-...'
    model: 'gpt-image-1'
    provider: 'generic'
```

The credential is forwarded explicitly: the harness scrubs credential-shaped
variables (`KEY`, `TOKEN`, `SECRET`, `PASSWORD`) out of the environment a child
would inherit, so an exported `IMAGE_GEN_API_KEY` is read at load time and
written into the child's environment by the plugin.

## Why this plugin ships a bridge

The server frames its stdio transport the LSP way — `Content-Length: <n>`
followed by a blank line — while the MCP client inside DeepSeek Harness reads
newline-delimited JSON. Mounted directly, the handshake would simply time out.
`bridge.mjs` translates in both directions: NDJSON in from the harness,
`Content-Length` frames to the server, and the reverse on the way back. Message
bodies are reframed byte for byte, never re-parsed.

## How it is mounted

`index.js` registers the skill, then mounts `scripts/server.mjs` through the
bridge over stdio with `failOnStartupError: true`. If `baseUrl` or `apiKey` is
missing it logs a warning and mounts nothing — a server that exits at startup
would otherwise fail the whole bundle load — while still registering the skill,
so the model can tell the user exactly what to configure.

## Development

```sh
npm test
```

Four suites, all Harness-free: the manifest and card metadata
(`test/plugin.test.mjs`), the bridge's framing and round trip
(`test/bridge.test.mjs`), the stdio mount and credential forwarding
(`test/mount.test.mjs`), and the bundled skill's registration
(`test/skill.test.mjs`). The repository's own Python validators still work:
`python scripts/validate_plugin.py .`, `python scripts/test_server.py`,
`python tests/test_provider_modes.py`.

## Repository layout

| Path | Purpose |
|---|---|
| `index.js` | the DSH plugin: skill provider + stdio mount |
| `bridge.mjs` | NDJSON ↔ `Content-Length` translation |
| `cordis.patch.yml` | the loader row that activates the plugin |
| `skills/image-generation/` | the bundled skill, adapted from the original |
| `locale/{en,zh}.json`, `assets/icon.svg` | card title, description and artwork |
| `scripts/server.mjs` | the MCP server, unchanged |
| `scripts/server.py`, `scripts/test_server.py` | the original Python HTTP debug server and its test, unchanged |
| `scripts/validate_plugin.py`, `tests/` | the original Codex-plugin validators and tests, unchanged |
| `.mcp.json`, `.codex-plugin/` | the original Codex plugin manifest, unchanged |
| `README.opencode.md` | the repository's original README, verbatim |

## Other hosts (unchanged)

```json
{
  "mcpServers": {
    "image-generation": {
      "command": "node",
      "args": ["scripts/server.mjs"],
      "env": {
        "IMAGE_GEN_BASE_URL": "${IMAGE_GEN_BASE_URL}",
        "IMAGE_GEN_API_KEY": "${IMAGE_GEN_API_KEY}"
      }
    }
  }
}
```

Two caveats carried over from the original setup: the relative
`scripts/server.mjs` needs the repository root as the working directory, and a
host that frames with newline-delimited JSON (like DSH) needs the bridge:
`node bridge.mjs -- node scripts/server.mjs`.

## License

[MIT](LICENSE) — the repository's own licence file, unchanged.
