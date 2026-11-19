import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import * as pluginShell from 'prettier-plugin-shell';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import defineConfig from './index.ts';

test('returns a Prettier config', () => {
	expectTypeOf(defineConfig).returns.toEqualTypeOf<PrettierConfig>();
});

test('merges custom config with the base config', () => {
	const config = {
		shUseTabs: true,
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
	} as const satisfies StandardConfig;

	const result = defineConfig(config);

	expect(result).toHaveProperty('shUseTabs', true);
	expect(result).toHaveProperty('singleQuote', false);
	expect(result).toHaveProperty('useTabs', false);

	expect(result).toHaveProperty('plugins', expect.any(Array));
	expect(result).toHaveProperty('overrides', expect.any(Array));
	expect(result.overrides).toContainEqual(config.overrides[0]);

	expect(result.plugins).toContain(pluginShell);

	for (const plugin of result.plugins!.filter(
		(plugin) => plugin !== pluginShell
	)) {
		expect(plugin).toContain('node_modules');
	}
});

test('supports `shTabWidth`', () => {
	expect(defineConfig({ shTabWidth: 4 })).toHaveProperty('shTabWidth', 4);
});
