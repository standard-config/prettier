import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import BASE_CONFIG from './index.ts';

test('is a valid Prettier config', () => {
	const { overrides, ...options } = BASE_CONFIG;

	expectTypeOf(BASE_CONFIG).toEqualTypeOf<StandardConfig>();

	expect(options).toMatchSnapshot();
	expect({ overrides }).toMatchSnapshot();
});
