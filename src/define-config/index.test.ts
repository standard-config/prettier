import type { Config } from 'prettier';
import { expect, expectTypeOf, test } from 'vitest';
import BASE_CONFIG from '../config.ts';
import defineConfig from './index.ts';

test('returns the base config by default', () => {
	const result = defineConfig();

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual(BASE_CONFIG);
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
	} as const satisfies Config;

	const result = defineConfig(config);

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toHaveProperty('singleQuote', false);
	expect(result).toHaveProperty('useTabs', false);
	expect(result).toHaveProperty('overrides', expect.any(Array));
	expect(result).toStrictEqual({
		...BASE_CONFIG,
		...config,
		overrides: [...BASE_CONFIG.overrides, ...config.overrides],
	});
});
