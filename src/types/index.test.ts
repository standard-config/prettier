import type { Options } from 'prettier';
import { expectTypeOf, test } from 'vitest';

test('extends Prettier’s `Options` with supported plugin properties', () => {
	expectTypeOf<Options>()
		.toHaveProperty('jsonRecursiveSort')
		.toEqualTypeOf<boolean | undefined>();

	expectTypeOf<Options>()
		.toHaveProperty('jsonSortOrder')
		.toEqualTypeOf<string | undefined>();

	expectTypeOf<Options>()
		.toHaveProperty('useTabs')
		.toEqualTypeOf<boolean | undefined>();
});
