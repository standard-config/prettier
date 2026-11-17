import type { ParserOptions } from 'prettier';
import { expect, test } from 'vite-plus/test';
import printWithoutComments from './index.ts';

const OPTIONS = {} as unknown as ParserOptions;

test('prints code without its comments', async () => {
	await expect(
		printWithoutComments('# foo\nbar   baz # qux\n', OPTIONS)
	).resolves.toBe('bar baz\n');
});

test('returns `undefined` for code that can’t be parsed', async () => {
	await expect(
		printWithoutComments('foo (', OPTIONS)
	).resolves.toBeUndefined();
});
