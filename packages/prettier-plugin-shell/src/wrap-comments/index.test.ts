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

test('keeps an empty line after a directive that covers the next line', async () => {
	const input = '# foo\n# nosemgrep: bar\n#\nbaz\n';

	await expect(wrapComments(input, OPTIONS)).resolves.toBe(input);
	await expect(wrapComments('# foo\n#\nbar\n', OPTIONS)).resolves.toBe(
		'# foo\nbar\n'
	);
});

test('keeps the line below a directive that covers it as written', async () => {
	const input =
		'foo # cspell:disable-next-line\n# bar baz qux quux\n# corge\n';
	const inputWithEmptyLine =
		'foo # cspell:disable-next-line\n#\n# bar baz\n# qux\n';

	await expect(wrapComments(input, OPTIONS)).resolves.toBe(input);
	await expect(wrapComments(inputWithEmptyLine, OPTIONS)).resolves.toBe(
		'foo # cspell:disable-next-line\n#\n# bar baz qux\n'
	);
	await expect(
		wrapComments('foo # cspell:disable-next-line\n#\nbar\n', OPTIONS)
	).resolves.toBe('foo # cspell:disable-next-line\n#\nbar\n');
	await expect(
		wrapComments(
			'foo # cspell:disable-next-line\n#\n# prettier-ignore\nbar\n',
			OPTIONS
		)
	).resolves.toBe(
		'foo # cspell:disable-next-line\n#\n# prettier-ignore\nbar\n'
	);
});

test('separates comment blocks with different indentation', async () => {
	const input = '  # foo\n# bar\n';

	await expect(wrapComments(input, OPTIONS)).resolves.toBe(input);
});

test('keeps comment lines apart in property files', async () => {
	const options = { ...OPTIONS, filepath: '.gitignore' } as ParserOptions;
	const input = '# foo\n# bar\nbaz\n';

	await expect(wrapComments(input, options)).resolves.toBe(input);
});
