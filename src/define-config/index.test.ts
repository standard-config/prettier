import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import defineConfig from './index.ts';

test('returns a Prettier config', () => {
	expectTypeOf(defineConfig).returns.toEqualTypeOf<PrettierConfig>();
});

test('merges custom config with the base config', () => {
	const config = {
		shellUseTabs: true,
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

	expect(result).toHaveProperty('singleQuote', false);
	expect(result).toHaveProperty('useTabs', true);

	expect(result).toHaveProperty('plugins', expect.any(Array));
	expect(result).toHaveProperty('overrides', expect.any(Array));
	expect(result.overrides).toContainEqual(config.overrides[0]);

	const { options } = result.overrides![0]!;

	expect(options).toHaveProperty('useTabs', false);

	expect(result.plugins).not.toHaveLength(0);

	for (const plugin of result.plugins!) {
		expect(plugin).toContain('node_modules');
	}
});
