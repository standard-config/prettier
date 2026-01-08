import { expect, test } from 'vitest';
import * as exports from './index.ts';

test('exposes correct public API', () => {
	expect({ ...exports }).toStrictEqual({
		defineConfig: expect.any(Function),
		prioritizeKeys: expect.any(Function),
	});
});
