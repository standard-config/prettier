import type { Config } from 'prettier';
import { expectTypeOf, test } from 'vitest';
import BASE_CONFIG from './config.ts';

test('is a valid Prettier config', () => {
	expectTypeOf(BASE_CONFIG).toExtend<Config>();

	/* @ts-expect-error */
	BASE_CONFIG.quoteProps = 'all';
});
