/**
 * Functional check for the skill half: the plugin is loaded with the Harness
 * packages stubbed, `apply()` runs against a stand-in context, and the bundled
 * skill it registers is inspected exactly as the Harness would read it.
 *
 * Run: `node --import ./test/hooks.mjs test/skill.test.mjs`
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { apply, inject, name } from "../index.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

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

console.log(`${name} plugin behaviour`);

const providers = [];
const logged = [];
const ctx = {
	skills: { registerProvider: (factory) => providers.push(factory) },
	plugin: async () => {},
	logger: { info: (m) => logged.push(m), warn: (m) => logged.push(m) },
};

await check("apply() registers exactly one skill provider", async () => {
	assert.ok(inject.includes("skills"), `unexpected inject ${JSON.stringify(inject)}`);
	apply(ctx, {});
	assert.equal(providers.length, 1, `expected one provider, got ${providers.length}`);
	return name;
});

await check("the provider lists the bundled skill with Harness-shaped metadata", async () => {
	const provider = providers[0]();
	assert.equal(provider.name, name);
	const list = await provider.list();
	assert.equal(list.length, 1, `expected one skill, got ${list.length}`);
	const candidate = list[0];
	assert.equal(candidate.name, "image-generation");
	assert.equal(candidate.source, "bundled");
	assert.equal(candidate.rank, 600);
	assert.equal(candidate.invocation?.modelInvocable, true);
	assert.equal(candidate.invocation?.userInvocable, true);
	assert.ok(candidate.description.length > 40, "description is too short to be useful");
	const locator = candidate.locator instanceof URL ? candidate.locator : new URL(candidate.locator);
	assert.ok(existsSync(locator), `${locator} does not exist`);
	assert.equal(candidate.resourceBase?.kind, "directory");
	assert.ok(statSync(candidate.resourceBase.path).isDirectory(), "resourceBase must be a directory");
	return `${candidate.name} rank=${candidate.rank}`;
});

await check("get() returns the skill body without front-matter", async () => {
	const provider = providers[0]();
	const [candidate] = await provider.list();
	const selected = await provider.get({ name: candidate.name });
	assert.ok(selected?.content, "no content returned");
	assert.ok(selected.content.length > 200, `content is ${selected.content.length} chars`);
	assert.ok(!selected.content.startsWith("---"), "front-matter was not stripped");
	assert.match(selected.content, /^#\s/mu, "body has no markdown heading");
	assert.equal(await provider.get({ name: "not-this-skill" }), undefined);
	return `${selected.content.length} chars`;
});

await check("the skill names the tools the server actually registers", async () => {
	const file = join(ROOT, "skills", "image-generation", "SKILL.md");
	const text = readFileSync(file, "utf8");
	for (const tool of ["image_generate", "image_config_status"]) {
		assert.ok(text.includes(tool), `the skill never mentions ${tool}`);
	}
	const server = readFileSync(join(ROOT, "scripts", "server.mjs"), "utf8");
	for (const tool of ["image_generate", "image_config_status"]) {
		assert.ok(server.includes(tool), `the server never registers ${tool}`);
	}
	return "image_generate, image_config_status";
});

await check("an unconfigured backend still registers the skill", async () => {
	assert.ok(
		logged.some((message) => message.includes("not mounted")),
		`expected the configuration warning, got ${JSON.stringify(logged)}`,
	);
	return "skill registered, mount skipped";
});

console.log(`\n${failed === 0 ? "all checks passed" : `${failed} check(s) failed`}`);
process.exit(failed === 0 ? 0 : 1);
