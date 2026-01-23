import type {
	IndentationOptions,
	PrettierPlugin,
	PrettierPlugins,
	ShellIndentationOptions,
	StandardConfig,
	StandardConfigOverride,
	StandardConfigOverrides,
	StandardOptions,
} from './index.d.ts';
import { expectTypeOf, test } from 'vitest';

test('exposes valid types', () => {
	expectTypeOf<PrettierPlugin>().not.toBeAny();
	expectTypeOf<PrettierPlugin>().not.toBeNever();

	expectTypeOf<PrettierPlugins>().toBeArray();

	expectTypeOf<IndentationOptions>().toBeObject();
	expectTypeOf<ShellIndentationOptions>().toBeObject();

	expectTypeOf<StandardConfig>().toBeObject();
	expectTypeOf<StandardOptions>().toBeObject();

	expectTypeOf<StandardConfigOverride>().toBeObject();
	expectTypeOf<StandardConfigOverrides>().toBeArray();
});
