/**
 * Resolve hook that substitutes stubs for the two Harness packages this plugin
 * imports, so `index.js` can be exercised outside a running Harness.
 *
 * Only `@deepseek-ai/dsh-mcp-client` and `@deepseek-ai/dsh-skill` are
 * redirected; every other specifier — the `node:` builtins especially —
 * resolves normally.
 */

import { registerHooks } from "node:module";

const STUBS = new Map([
	["@deepseek-ai/dsh-mcp-client", new URL("./stub-dsh-mcp-client.mjs", import.meta.url).href],
	["@deepseek-ai/dsh-skill", new URL("./stub-dsh-skill.mjs", import.meta.url).href],
]);

registerHooks({
	resolve(specifier, context, nextResolve) {
		const stub = STUBS.get(specifier);
		if (stub !== undefined) return { url: stub, shortCircuit: true };
		return nextResolve(specifier, context);
	},
});
