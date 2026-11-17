import type { Options as PrettierOptions } from 'prettier';
import type { PluginOptions } from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
	expectTypeOf<PluginOptions>()
		.toHaveProperty('shellWrapComments')
		.toEqualTypeOf<boolean | undefined>();
});

test('extends Prettier’s `Options`', () => {
	expectTypeOf<PrettierOptions>().toBeObject();
	expectTypeOf<PrettierOptions>().toHaveProperty('useTabs');

	expectTypeOf<PrettierOptions>()
		.toHaveProperty('shellWrapComments')
		.toEqualTypeOf<boolean | undefined>();
});
