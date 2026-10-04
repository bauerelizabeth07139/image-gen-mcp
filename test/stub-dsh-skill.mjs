/**
 * Stand-in for `@deepseek-ai/dsh-skill` used by `hooks.mjs`.
 *
 * The plugin imports exactly one symbol from the real package: the rank a
 * bundled skill is registered at. The value matches the Harness (600), so a
 * test can assert the registration carries it.
 */

export const BUNDLED_SKILL_RANK = 600;
