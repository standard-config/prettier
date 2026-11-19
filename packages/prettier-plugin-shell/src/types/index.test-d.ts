import type { Options as PrettierOptions } from 'prettier';
import type { PluginOptions } from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
	expectTypeOf<PluginOptions>()
		.toHaveProperty('shCommentWrap')
		.toEqualTypeOf<'all' | 'full-line' | 'none' | undefined>();
	expectTypeOf<PluginOptions>()
		.toHaveProperty('shTabWidth')
		.toEqualTypeOf<number | undefined>();
	expectTypeOf<PluginOptions>()
		.toHaveProperty('shUseTabs')
		.toEqualTypeOf<boolean | undefined>();
});

test('extends Prettier’s `Options`', () => {
	expectTypeOf<PrettierOptions>().toBeObject();
	expectTypeOf<PrettierOptions>().toHaveProperty('useTabs');

	expectTypeOf<PrettierOptions>()
		.toHaveProperty('shCommentWrap')
		.toEqualTypeOf<'all' | 'full-line' | 'none' | undefined>();
	expectTypeOf<PrettierOptions>()
		.toHaveProperty('shTabWidth')
		.toEqualTypeOf<number | undefined>();
	expectTypeOf<PrettierOptions>()
		.toHaveProperty('shUseTabs')
		.toEqualTypeOf<boolean | undefined>();
});
