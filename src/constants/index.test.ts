import { expect, test } from 'vite-plus/test';
import * as exports from './index.ts';

test('exposes correct constants', () => {
	expect({ ...exports }).toMatchSnapshot();
});
