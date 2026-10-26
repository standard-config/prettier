import { expect, test } from 'vite-plus/test';
import * as exports from './index.ts';

test('exposes correct public API', () => {
	expect({ ...exports }).toMatchInlineSnapshot(`
		{
		  "defineConfig": [Function],
		  "prioritizeKeys": [Function],
		}
	`);
});
