---
name: image-generation
description: Generate images through the image generation MCP server. Use when the user wants a new raster image, a creative variation, or an asset produced from a text prompt, and the configured image generation backend is available.
metadata:
  short-description: Image generation tools
---

# Image Generation

Use the MCP tools exposed by this plugin when image generation is requested.

## Tools
- image_generate - create an image from a prompt.
- image_config_status - check whether base URL and API key are configured.

## Workflow

### Planner discipline
- If the request is short and text-only configuration work, the planner may stay inline.
- If the request involves image creation, file packaging, screenshot inspection, or UI review, spawn a worker subagent for the heavy work.
- Keep the main loop response for final decisions only.

## Planner Guidance

Keep the main planning loop lean:
- Do not fetch, render, or describe images inline when an image-generation subagent can do it.
- Delegate file/path inspection and MCP calls to a worker subagent when the task is non-trivial.
- Only return final artifacts, file paths, and short actionable summaries.

1. Confirm configuration with image_config_status.
2. Generate the image with image_generate.
3. Return the image artifact or an actionable error.

## Error Handling
## Subagent Rules

- Default worker model: inherit the parent model for text/code config checks.
- Visual rule: if the task involves creating, rendering, or verifying images, screenshots, or visual assets, use a multimodal model for the worker/subagent. If the parent model is not multimodal, override the subagent model explicitly.
- Keep subagent context small: pass prompts, file paths, and acceptance criteria only.

- If base URL or API key is missing, ask for configuration.
- If the provider returns an error, summarize the upstream failure and retry safely when idempotent.


