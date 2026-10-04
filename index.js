/**
 * `dsh-image-gen-mcp` — a DeepSeek Harness host plugin for the image-generation
 * MCP server in this repository.
 *
 * Two halves:
 *
 * - The server (`scripts/server.mjs`) is mounted as a stdio MCP server, so its
 *   tools reach the model as `mcp__image_generation__image_generate` and
 *   `mcp__image_generation__image_config_status`.
 * - The bundled `image-generation` skill is registered, so the model knows when
 *   and how to use them.
 *
 * The server frames its stdio transport the LSP way (`Content-Length`), while
 * the MCP client inside the harness reads newline-delimited JSON, so the mount
 * goes through the `bridge.mjs` this plugin ships.
 *
 * @module dsh-image-gen-mcp
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	apply as applyMcpClient,
	Config as McpClientConfig,
	inject as mcpClientInject,
	name as mcpClientName,
} from "@deepseek-ai/dsh-mcp-client";
import { BUNDLED_SKILL_RANK } from "@deepseek-ai/dsh-skill";

/** Plugin identity, used by the loader row. */
export const name = "dsh-image-gen-mcp";
/** The registry this plugin registers its skill into. */
export const inject = ["skills"];

const ROOT = dirname(fileURLToPath(import.meta.url));
const SERVER_NAME = "image_generation";
const SERVER_SCRIPT = join(ROOT, "scripts", "server.mjs");
const BRIDGE_PATH = join(ROOT, "bridge.mjs");
const SKILL_ROOT = join(ROOT, "skills", "image-generation");
const SKILL_PATH = join(SKILL_ROOT, "SKILL.md");
const SKILL_NAME = "image-generation";

const DESCRIPTION =
	"Generate images through this plugin's MCP server. Use when the user wants " +
	"a new raster image, a creative variation, or an asset produced from a text " +
	"prompt, and the configured image-generation backend is available.";

/** Config key → environment variable, for everything the server reads. */
const ENV_MAP = {
	baseUrl: "IMAGE_GEN_BASE_URL",
	model: "IMAGE_GEN_DEFAULT_MODEL",
	timeoutMs: "IMAGE_GEN_TIMEOUT_MS",
	provider: "IMAGE_GEN_PROVIDER",
};

/**
 * Read the skill body without its YAML front-matter.
 * @returns {Promise<string>} the markdown the model receives.
 */
async function readSkill() {
	return (await readFile(SKILL_PATH, "utf8"))
		.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "")
		.trim();
}

/**
 * Build the child environment. The harness scrubs credential-shaped variables
 * out of an inherited environment, so the API key is written in explicitly.
 * @param {object} config - plugin configuration.
 * @returns {Record<string, string>} the child environment.
 */
function buildEnv(config) {
	const env = { ...(config.env ?? {}) };
	for (const [key, variable] of Object.entries(ENV_MAP)) {
		const value = config[key] ?? process.env[variable];
		if (value !== undefined && value !== "") env[variable] = String(value);
	}
	const key = config.apiKey ?? process.env.IMAGE_GEN_API_KEY;
	if (key !== undefined && key !== "") env.IMAGE_GEN_API_KEY = key;
	return env;
}

/**
 * Mount the server and register the skill.
 * @param {object} ctx - registrant context.
 * @param {object} [config] - deployment configuration.
 * @param {string} [config.apiKey] - backend credential.
 * @param {string} [config.baseUrl] - backend base URL, without a trailing `/v1`.
 * @param {string} [config.model] - default model id.
 * @param {number} [config.timeoutMs] - the server's own HTTP budget.
 * @param {string} [config.provider] - `generic` or `openai`.
 * @param {number} [config.toolCallTimeoutMs] - DSH's per-call budget.
 * @param {Record<string, string>} [config.env] - raw environment passthrough.
 */
export async function apply(ctx, config = {}) {
	ctx.skills.registerProvider(() => {
		const candidate = {
			name: SKILL_NAME,
			description: DESCRIPTION,
			invocation: { modelInvocable: true, userInvocable: true },
			provider: name,
			source: "bundled",
			rank: BUNDLED_SKILL_RANK,
			locator: pathToFileURL(SKILL_PATH),
			resourceBase: { kind: "directory", path: SKILL_ROOT },
		};
		return {
			name,
			list: async () => [candidate],
			get: async (selected) =>
				selected.name === candidate.name
					? { ...candidate, content: await readSkill() }
					: undefined,
		};
	});

	const env = buildEnv(config);
	if (!(env.IMAGE_GEN_BASE_URL ?? "").trim() || !(env.IMAGE_GEN_API_KEY ?? "").trim()) {
		ctx.logger.warn(
			`${name}: the image-generation server is not mounted because ` +
				"`baseUrl` and `apiKey` are both required. Set them in the loader row " +
				"(or export IMAGE_GEN_BASE_URL and IMAGE_GEN_API_KEY). The skill is registered either way.",
		);
		return;
	}

	const toolCallTimeoutMs =
		Number.isFinite(config.toolCallTimeoutMs) && config.toolCallTimeoutMs > 0
			? config.toolCallTimeoutMs
			: 120000;

	await ctx.plugin(
		{
			name: `${name}-mcp`,
			inject: mcpClientInject,
			Config: McpClientConfig,
			apply: applyMcpClient,
		},
		{
			transport: "stdio",
			serverName: SERVER_NAME,
			command: process.execPath,
			args: [BRIDGE_PATH, "--", process.execPath, SERVER_SCRIPT],
			cwd: ROOT,
			env,
			toolCallTimeoutMs,
			failOnStartupError: true,
		},
	);

	ctx.logger.info(`${name}: mounted ${SERVER_NAME} through ${mcpClientName}`);
}
