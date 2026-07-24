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
1. Confirm configuration with image_config_status.
2. Generate the image with image_generate.
3. Return the image artifact or an actionable error.

## Error Handling
- If base URL or API key is missing, ask for configuration.
- If the provider returns an error, summarize the upstream failure and retry safely when idempotent.

