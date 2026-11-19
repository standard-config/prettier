import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import generateConfig from './index.ts';

test('generates a valid Prettier config', () => {
	const config = generateConfig();
	const { overrides, plugins, ...options } = config;

	expectTypeOf(config).toEqualTypeOf<StandardConfig>();
	expect({ plugins }).toMatchSnapshot();
	expect(options).toMatchSnapshot();
	expect({ overrides }).toMatchSnapshot();
});
