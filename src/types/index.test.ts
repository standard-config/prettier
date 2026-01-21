import type {
	Config as PrettierConfig,
	Options as PrettierOptions,
} from 'prettier';
import type {
	IndentationOptions,
	ShellIndentationOptions,
	StandardConfig,
	StandardConfigOverride,
	StandardConfigOverrides,
	StandardOptions,
} from './index.d.ts';
import { expectTypeOf, test } from 'vitest';

test('exposes valid types', () => {
	expectTypeOf<IndentationOptions>().toBeObject();
	expectTypeOf<ShellIndentationOptions>().toBeObject();

	expectTypeOf<StandardConfig>().toBeObject();
	expectTypeOf<StandardConfig>().toExtend<PrettierConfig>();

	expectTypeOf<StandardOptions>().toBeObject();
	expectTypeOf<StandardOptions>().toExtend<PrettierOptions>();

	expectTypeOf<StandardConfigOverride>().toBeObject();
	expectTypeOf<StandardConfigOverrides>().toBeArray();
});
