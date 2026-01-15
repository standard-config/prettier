import type { Config, Options } from 'prettier';
import { expectTypeOf, test } from 'vitest';
import { DEFAULT_CONFIG, DEFAULT_OPTIONS } from './index.ts';

test('is a valid Prettier config', () => {
	expectTypeOf(DEFAULT_CONFIG).toExtend<Config>();
	expectTypeOf(DEFAULT_OPTIONS).toExtend<Options>();

	/* @ts-expect-error */
	DEFAULT_CONFIG.quoteProps = 'all';

	/* @ts-expect-error */
	DEFAULT_OPTIONS.quoteProps = 'all';
});
