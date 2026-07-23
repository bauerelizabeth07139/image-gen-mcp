import http from "node:http";
import { URL } from "node:url";

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

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && new URL(req.url, "http://localhost").pathname === "/health") {
      const missing = missingConfig();
      send(res, 200, {
        ok: missing.length === 0,
        configuredBaseUrl: Boolean(config.baseUrl),
        configuredApiKey: Boolean(config.apiKey),
        missing,
      });
      return;
    }

    if (req.method === "POST" && new URL(req.url, "http://localhost").pathname === "/call-tool") {
      const body = JSON.parse(await readBody(req));
      const tool = body?.tool;
      const args = body?.args || {};

      if (tool === "image_config_status") {
        const missing = missingConfig();
        send(res, 200, {
          ok: missing.length === 0,
          configuredBaseUrl: Boolean(config.baseUrl),
          configuredApiKey: Boolean(config.apiKey),
          defaultModel: config.defaultModel || null,
          provider: config.provider,
          missing,
        });
        return;
      }

      if (tool === "image_generate") {
        const prompt = String(args.prompt || "").trim();
        if (!prompt) {
          send(res, 400, { error: "prompt is required" });
          return;
        }
        const missing = missingConfig();
        if (missing.length) {
          send(res, 400, { error: "missing configuration", missing });
          return;
        }
        try {
          const upstream = await forward(buildUpstreamPayload(args));
          send(res, 200, { ok: true, provider: config.provider, upstream });
        } catch (err) {
          send(res, 502, { error: "upstream request failed", detail: String(err) });
        }
        return;
      }

      send(res, 404, { error: `unknown tool: ${tool}` });
      return;
    }

    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 400, { error: String(err) });
  }
});

const listener = server.listen(0, "127.0.0.1", () => {
  const addr = listener.address();
  console.log(`IMAGE_GEN_SERVER_URL=http://127.0.0.1:${addr.port}`);
});
