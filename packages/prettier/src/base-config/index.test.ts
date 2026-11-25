import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vite-plus/test';
// The TypeScript plugin doesn’t export its parity test options, so import them
// by relative path
import { OPTION_SETS } from '../../../prettier-plugin-typescript/src/oxc-parity-cases/index.ts';
import BASE_CONFIG from './index.ts';

test('is a valid Prettier config', () => {
	const { overrides, ...options } = BASE_CONFIG;

	expectTypeOf(BASE_CONFIG).toEqualTypeOf<StandardConfig>();

	expect(options).toMatchSnapshot();
	expect({ overrides }).toMatchSnapshot();
});

test('uses the same global formatting options as the Oxc parity tests', () => {
	const {
		overrides: _overrides,
		plugins: _plugins,
		...options
	} = BASE_CONFIG;

	expect(OPTION_SETS.config).toStrictEqual(options);
});
