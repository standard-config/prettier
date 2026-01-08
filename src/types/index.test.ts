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
		.toHaveProperty('packageSortOrder')
		.toEqualTypeOf<string[] | undefined>();

	expectTypeOf<Options>()
		.toHaveProperty('useTabs')
		.toEqualTypeOf<boolean | undefined>();
});

test('provides the types for `prettier-plugin-packagejson`', () => {
	/* oxlint-disable-next-line consistent-type-imports */
	type PrettierPlugin = typeof import('prettier-plugin-packagejson');

	expectTypeOf<PrettierPlugin>().not.toBeAny();
	expectTypeOf<PrettierPlugin>().not.toBeNever();

	expectTypeOf<PrettierPlugin>().toHaveProperty('options');
	expectTypeOf<PrettierPlugin>().toHaveProperty('parsers');
	expectTypeOf<PrettierPlugin>().toHaveProperty('testPath');
});
