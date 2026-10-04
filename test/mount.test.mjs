/**
 * Functional check for the mount half: the plugin is loaded with
 * `@deepseek-ai/dsh-mcp-client` and `@deepseek-ai/dsh-skill` stubbed, and the
 * stdio mount it performs is inspected — including the NDJSON bridge it puts in
 * front of the server, and the refusal to mount when the backend is unconfigured.
 *
 * Run: `node --import ./test/hooks.mjs test/mount.test.mjs`
 */

import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { apply, name } from "../index.js";

const CONFIG = { baseUrl: "https://api.example.test", apiKey: "test-key" };

let failed = 0;
async function check(label, body) {
	try {
		const detail = await body();
		console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
	} catch (error) {
		failed++;
		console.log(`  FAIL  ${label} — ${error.message}`);
	}
}

console.log(`${name} stdio mount`);

function makeContext() {
	const mounts = [];
	const logs = [];
	return {
		mounts,
		logs,
		plugin: async (plugin, options) => mounts.push({ plugin, options }),
		logger: { info: (m) => logs.push(m), warn: (m) => logs.push(m) },
		skills: { registerProvider: () => {} },
	};
}

await check("apply() mounts the Node server through the NDJSON bridge", async () => {
	const ctx = makeContext();
	await apply(ctx, CONFIG);
	assert.equal(ctx.mounts.length, 1, `expected one mount, got ${ctx.mounts.length}`);
	const { plugin, options } = ctx.mounts[0];
	assert.equal(plugin.name, `${name}-mcp`);
	assert.equal(typeof plugin.apply, "function");
	assert.equal(options.transport, "stdio");
	assert.equal(options.serverName, "image_generation");
	assert.equal(options.failOnStartupError, true);
	assert.equal(options.command, process.execPath);
	assert.match(options.args[0], /bridge\.mjs$/u, `unexpected argv ${JSON.stringify(options.args)}`);
	assert.equal(options.args[1], "--");
	assert.equal(options.args[2], process.execPath);
	assert.match(options.args[3], /server\.mjs$/u);
	assert.ok(existsSync(options.args[3]), `server script missing: ${options.args[3]}`);
	assert.ok(existsSync(options.cwd) && statSync(options.cwd).isDirectory(), "cwd must be a directory");
	assert.equal(options.toolCallTimeoutMs, 120000);
	return `${options.serverName} via ${options.args[0].split(/[\\/]/u).pop()}`;
});

await check("base URL and key reach the server's environment", async () => {
	const ctx = makeContext();
	await apply(ctx, { ...CONFIG, model: "gpt-image-1", provider: "openai", timeoutMs: 45000 });
	const { options } = ctx.mounts[0];
	assert.equal(options.env.IMAGE_GEN_BASE_URL, "https://api.example.test");
	assert.equal(options.env.IMAGE_GEN_API_KEY, "test-key");
	assert.equal(options.env.IMAGE_GEN_DEFAULT_MODEL, "gpt-image-1");
	assert.equal(options.env.IMAGE_GEN_PROVIDER, "openai");
	assert.equal(options.env.IMAGE_GEN_TIMEOUT_MS, "45000");
	return "all five variables";
});

await check("an exported key is forwarded despite the harness scrub", async () => {
	const previous = process.env.IMAGE_GEN_API_KEY;
	process.env.IMAGE_GEN_API_KEY = "from-the-environment";
	try {
		const ctx = makeContext();
		await apply(ctx, { baseUrl: "https://api.example.test" });
		assert.equal(ctx.mounts[0].options.env.IMAGE_GEN_API_KEY, "from-the-environment");
	} finally {
		if (previous === undefined) delete process.env.IMAGE_GEN_API_KEY;
		else process.env.IMAGE_GEN_API_KEY = previous;
	}
	return "IMAGE_GEN_API_KEY";
});

await check("an unconfigured backend warns instead of mounting a dead server", async () => {
	const ctx = makeContext();
	await apply(ctx, {});
	assert.equal(ctx.mounts.length, 0, "nothing should be mounted");
	assert.ok(
		ctx.logs.some((message) => message.includes("not mounted")),
		`expected a warning, got ${JSON.stringify(ctx.logs)}`,
	);
	return "warned, did not mount";
});

await check("a raised timeout is honoured", async () => {
	const ctx = makeContext();
	await apply(ctx, { ...CONFIG, toolCallTimeoutMs: 4242 });
	assert.equal(ctx.mounts[0].options.toolCallTimeoutMs, 4242);
	return "4242 ms";
});

console.log(`\n${failed === 0 ? "all checks passed" : `${failed} check(s) failed`}`);
process.exit(failed === 0 ? 0 : 1);
