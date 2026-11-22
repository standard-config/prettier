import type { Config as PrettierConfig } from 'prettier';
import * as pluginShell from 'prettier-plugin-shell';
import * as pluginTypeScript from 'prettier-plugin-typescript';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import defineConfig from './index.ts';

test('returns a Prettier config', () => {
	expectTypeOf(defineConfig).returns.toEqualTypeOf<PrettierConfig>();
});

test('merges custom config with the base config', () => {
	const config = {
		singleQuote: false,
		useTabs: false,
		overrides: [
			{
				files: ['*.html'],
				options: {
					printWidth: 160,
				},
			},
		],
	} as const satisfies PrettierConfig;

	const result = defineConfig(config);

	expect(result).toHaveProperty('singleQuote', false);
	expect(result).toHaveProperty('useTabs', false);

	expect(result).toHaveProperty('overrides', expect.any(Array));
	expect(result.overrides).toContainEqual(config.overrides[0]);

	expect(result).toHaveProperty('plugins', expect.any(Array));
	expect(result.plugins).toContain(pluginShell);
	expect(result.plugins).toContain(pluginTypeScript);

	for (const plugin of result.plugins!.filter(
		(plugin) => plugin !== pluginShell && plugin !== pluginTypeScript
	)) {
		expect(plugin).toContain('node_modules');
	}
});

test('supports custom config options', () => {
	const config = {
		shCommentWrap: 'none',
		shTabWidth: 4,
		shUseTabs: true,
		tsCommentWrap: 'none',
	} as const satisfies PrettierConfig;

	const result = defineConfig(config);

	expect(result).toHaveProperty('shCommentWrap', 'none');
	expect(result).toHaveProperty('shTabWidth', 4);
	expect(result).toHaveProperty('shUseTabs', true);
	expect(result).toHaveProperty('tsCommentWrap', 'none');
});
