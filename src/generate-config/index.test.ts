import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vitest';
import generateConfig from './index.ts';

test('generates a valid Prettier config', () => {
	const config = generateConfig();

	expectTypeOf(config).toEqualTypeOf<StandardConfig>();
	expect(config).toMatchSnapshot();
});

test('accepts custom formatting options', () => {
	const config = generateConfig({ tabWidth: 2 }, { shellTabWidth: 4 });

	expectTypeOf(config).toEqualTypeOf<StandardConfig>();

	expect(config).toHaveProperty('tabWidth', 4);
	expect(config).toHaveProperty('useTabs', false);

	const { options } = config.overrides![0]!;

	expect(options).toHaveProperty('tabWidth', 2);
	expect(options).toHaveProperty('useTabs', true);
});
