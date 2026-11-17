import type { ParserOptions } from 'prettier';
import { expect, test } from 'vite-plus/test';
import wrapComments from './index.ts';

const OPTIONS = { printWidth: 14, tabWidth: 2 } as unknown as ParserOptions;

test('leaves text without comments unchanged', async () => {
	await expect(wrapComments('foo\n', OPTIONS)).resolves.toBe('foo\n');
});

test('formats comment blocks at their indentation', async () => {
	const input = 'foo() {\n  # bar baz qux\n  # quux\n  corge\n}\n';

	await expect(wrapComments(input, OPTIONS)).resolves.toBe(
		'foo() {\n  # bar baz\n  # qux quux\n  corge\n}\n'
	);
});

test('counts tabs as `tabWidth` columns', async () => {
	const options = { ...OPTIONS, tabWidth: 4 } as ParserOptions;

	await expect(wrapComments('\t# foo bar baz\n', options)).resolves.toBe(
		'\t# foo bar\n\t# baz\n'
	);
});

test('treats pragmas as directives only in the leading comments', async () => {
	const input = '# foo\n# @format\nbar\n# baz\n# @format\n';

	await expect(wrapComments(input, OPTIONS)).resolves.toBe(
		'# foo\n#\n# @format\nbar\n# baz @format\n'
	);
});

test('separates comment blocks with different indentation', async () => {
	const input = '  # foo\n# bar\n';

	await expect(wrapComments(input, OPTIONS)).resolves.toBe(input);
});
