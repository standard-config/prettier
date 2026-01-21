import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vitest';
import generateConfig from '../generate-config/index.ts';
import defineConfig from './index.ts';

const DEFAULT_CONFIG = generateConfig();

test('returns the base config by default', () => {
	const result = defineConfig();

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result).toStrictEqual(DEFAULT_CONFIG);
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

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result).toHaveProperty('singleQuote', false);
	expect(result).toHaveProperty('useTabs', true);
	expect(result).toHaveProperty('overrides', expect.any(Array));
	expect(result.overrides).toContainEqual(config.overrides[0]);

	const override = result.overrides![0]!.options;

	expect(override).toHaveProperty('useTabs', false);
});
