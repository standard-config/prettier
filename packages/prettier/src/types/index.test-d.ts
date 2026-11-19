import type {
	StandardConfig,
	StandardConfigOverride,
	StandardConfigOverrides,
	StandardOptions,
} from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
	expectTypeOf<StandardConfig>().toBeObject();
	expectTypeOf<StandardOptions>().toBeObject();

	expectTypeOf<StandardOptions>().toHaveProperty('jsonSortOrder');
	expectTypeOf<StandardOptions>()
		.toHaveProperty('shCommentWrap')
		.toEqualTypeOf<'all' | 'full-line' | 'none' | undefined>();
	expectTypeOf<StandardOptions>()
		.toHaveProperty('shTabWidth')
		.toEqualTypeOf<number | undefined>();
	expectTypeOf<StandardOptions>()
		.toHaveProperty('shUseTabs')
		.toEqualTypeOf<boolean | undefined>();

	expectTypeOf<StandardConfigOverride>().toBeObject();
	expectTypeOf<StandardConfigOverrides>().toBeArray();
});
