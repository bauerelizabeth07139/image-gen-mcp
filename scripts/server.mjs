import http from "node:http";
import { URL } from "node:url";
import readline from "node:readline";

// ©¤©¤©¤ Configuration ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

const config = {
  baseUrl: (process.env.IMAGE_GEN_BASE_URL || "").trim(),
  apiKey: (process.env.IMAGE_GEN_API_KEY || "").trim(),
  defaultModel: (process.env.IMAGE_GEN_DEFAULT_MODEL || "").trim(),
  timeoutMs: Number(process.env.IMAGE_GEN_TIMEOUT_MS || "30000"),
  provider: (process.env.IMAGE_GEN_PROVIDER || "generic").trim().toLowerCase() || "generic",
};

function missingConfig() {
  const missing = [];
  if (!config.baseUrl) missing.push("IMAGE_GEN_BASE_URL");
  if (!config.apiKey) missing.push("IMAGE_GEN_API_KEY");
  return missing;
}

// ©¤©¤©¤ Upstream proxy logic ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

function buildUpstreamPayload(args) {
  if (config.provider === "openai") {
    return {
      model: args.model || config.defaultModel || "dall-e-3",
      prompt: args.prompt,
      n: 1,
      size: args.size || "1024x1024",
      response_format: "b64_json",
    };
  }
  return {
    model: args.model || config.defaultModel || "gpt-image-1",
    prompt: args.prompt,
    size: args.size || "1024x1024",
    n: args.n || 1,
    response_format: args.response_format || "b64_json",
  };
}

async function forward(payload) {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/v1/images/generations`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`upstream ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ©¤©¤©¤ Tool definitions ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

const TOOLS = [
  {
    name: "image_generate",
    description: "Generate an image from a text prompt using the configured image generation API.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Text prompt describing the image to generate." },
        model: { type: "string", description: "Override the default model." },
        size: { type: "string", description: "Image size, e.g. 1024x1024." },
        n: { type: "number", description: "Number of images to generate." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "image_config_status",
    description: "Check whether the image generation API base URL and key are configured.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function handleToolCall(name, args) {
  if (name === "image_config_status") {
    const missing = missingConfig();
    return {
      ok: missing.length === 0,
      configuredBaseUrl: Boolean(config.baseUrl),
      configuredApiKey: Boolean(config.apiKey),
      defaultModel: config.defaultModel || null,
      provider: config.provider,
      missing,
    };
  }

  if (name === "image_generate") {
    const prompt = String(args?.prompt || "").trim();
    if (!prompt) throw new Error("prompt is required");
    const missing = missingConfig();
    if (missing.length) throw new Error(`missing configuration: ${missing.join(", ")}`);
    const upstream = await forward(buildUpstreamPayload(args || {}));
    return { ok: true, provider: config.provider, upstream };
  }

  throw new Error(`unknown tool: ${name}`);
}

// ©¤©¤©¤ MCP stdio transport ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

let nextId = 1;
function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}
function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

async function handleRequest(req) {
  const { id, method, params } = req;

  if (method === "initialize") {
    sendResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "image-generation", version: "0.3.1" },
    });
    return;
  }

  if (method === "notifications/initialized") {
    // no response needed for notifications
    return;
  }

  if (method === "tools/list") {
    sendResponse(id, { tools: TOOLS });
    return;
  }

  if (method === "tools/call") {
    try {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const result = await handleToolCall(toolName, toolArgs);
      sendResponse(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } catch (err) {
      sendResponse(id, {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      });
    }
    return;
  }

  sendError(id, -32601, `Method not found: ${method}`);
}

function runMcpStdio() {
  let buffer = "";
  let contentLength = -1;

  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    while (true) {
      if (contentLength === -1) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) break;
        const header = buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          buffer = buffer.substring(headerEnd + 4);
          continue;
        }
        contentLength = parseInt(match[1], 10);
        buffer = buffer.substring(headerEnd + 4);
      }
      if (Buffer.byteLength(buffer, "utf-8") < contentLength) break;
      const msgBuffer = Buffer.from(buffer, "utf-8");
      const msgStr = msgBuffer.subarray(0, contentLength).toString("utf-8");
      buffer = msgBuffer.subarray(contentLength).toString("utf-8");
      contentLength = -1;
      try {
        const req = JSON.parse(msgStr);
        handleRequest(req);
      } catch {
        // ignore parse errors
      }
    }
  });

  process.stdin.on("end", () => process.exit(0));
}

// ©¤©¤©¤ HTTP mode (legacy, for testing) ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

function runHttp() {
  const server = http.createServer(async (req, res) => {
    function send(status, payload) {
      const body = JSON.stringify(payload);
      res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
      res.end(body);
    }
    function readBody() {
      return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
      });
    }
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (req.method === "GET" && pathname === "/health") {
        const m = missingConfig();
        send(200, { ok: m.length === 0, configuredBaseUrl: Boolean(config.baseUrl), configuredApiKey: Boolean(config.apiKey), missing: m });
        return;
      }
      if (req.method === "POST" && pathname === "/call-tool") {
        const body = JSON.parse(await readBody());
        const tool = body?.tool;
        const args = body?.args || {};
        try {
          const result = await handleToolCall(tool, args);
          send(200, result);
        } catch (err) {
          const status = err.message.includes("prompt is required") ? 400
            : err.message.includes("missing configuration") ? 400
            : err.message.includes("upstream") ? 502 : 500;
          send(status, { error: err.message });
        }
        return;
      }
      send(404, { error: "not found" });
    } catch (err) {
      send(400, { error: String(err) });
    }
  });
  const listener = server.listen(0, "127.0.0.1", () => {
    const addr = listener.address();
    console.log(`IMAGE_GEN_SERVER_URL=http://127.0.0.1:${addr.port}`);
  });
}

// ©¤©¤©¤ Entry point ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤

if (process.argv.includes("--http")) {
  runHttp();
} else {
  runMcpStdio();
}