import type {
	IndentationOptions,
	ShellIndentationOptions,
	StandardConfig,
	StandardConfigOverride,
	StandardConfigOverrides,
	StandardOptions,
} from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
	expectTypeOf<IndentationOptions>().toBeObject();
	expectTypeOf<ShellIndentationOptions>().toBeObject();

	expectTypeOf<StandardConfig>().toBeObject();
	expectTypeOf<StandardOptions>().toBeObject();

	expectTypeOf<StandardConfigOverride>().toBeObject();
	expectTypeOf<StandardConfigOverrides>().toBeArray();
});
