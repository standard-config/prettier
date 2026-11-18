import type { Options, ParserOptions, Plugin } from 'prettier';
import { format } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { expect, test } from 'vite-plus/test';
import wrapComments from './index.ts';

async function getParserOptions(
	text: string,
	options: Options = {}
): Promise<ParserOptions> {
	let parserOptions: ParserOptions | undefined;

	const plugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				preprocess: (code, preprocessOptions) => {
					parserOptions ??= preprocessOptions;
					return code;
				},
			},
		},
	};

	await format(text, { ...options, parser: 'babel', plugins: [plugin] });
	return parserOptions!;
}

async function wrap(text: string, options: Options = {}): Promise<string> {
	return wrapComments(
		text,
		'babel',
		await getParserOptions(text, { printWidth: 14, ...options })
	);
}

test('leaves text without comments unchanged', async () => {
	await expect(wrap('foo();\n')).resolves.toBe('foo();\n');
});

test('formats comment groups at their formatted indentation', async () => {
	const input = 'function foo() {\n// bar baz qux\n// quux\ncorge();\n}\n';

	await expect(wrap(input)).resolves.toBe(
		'function foo() {\n// bar baz\n// qux quux\ncorge();\n}\n'
	);
});

test('counts tabs as `tabWidth` columns', async () => {
	await expect(
		wrap('{\n// foo bar baz\n}\n', { tabWidth: 4, useTabs: true })
	).resolves.toBe('{\n// foo bar\n// baz\n}\n');
});

test('separates comment groups at empty lines and code', async () => {
	const input = '// foo\n\n// bar\nbaz();\n// qux\n';

	await expect(wrap(input)).resolves.toBe(input);
});

test('turns directives into block comments', async () => {
	await expect(
		wrap('// foo\n//\n// @ts-expect-error\n//\n// bar\nbaz();\n')
	).resolves.toBe('// foo\n/* @ts-expect-error */\n// bar\nbaz();\n');
});

test('turns the last comment before a `case` into a fall-through comment', async () => {
	await expect(
		wrap(
			'switch (foo) {\ncase 1:\n// bar\n// falls through\ncase 2:\n}\n',
			{
				printWidth: 80,
			}
		)
	).resolves.toBe(
		'switch (foo) {\ncase 1:\n// bar\n/* falls through */\ncase 2:\n}\n'
	);
	await expect(
		wrap('switch (foo) {\ncase 1:\n// bar fall\n// through\ncase 2:\n}\n', {
			printWidth: 80,
		})
	).resolves.toBe(
		'switch (foo) {\ncase 1:\n/* bar fall through */\ncase 2:\n}\n'
	);
});

test('keeps fall-through comments at the end of a `case` block apart', async () => {
	await expect(
		wrap(
			'switch (foo) {\ncase 1: {\nbar();\n// baz qux quux corge\n// falls through\n}\ndefault:\n}\n',
			{ printWidth: 40 }
		)
	).resolves.toBe(
		'switch (foo) {\ncase 1: {\nbar();\n// baz qux quux corge\n/* falls through */\n}\ndefault:\n}\n'
	);
});

test('treats fall-through comments elsewhere as text', async () => {
	const input =
		'switch (foo) {\ncase 1:\n// bar falls through\n// baz qux quux\ndefault:\n}\n';

	await expect(wrap(input, { printWidth: 24 })).resolves.toBe(input);
	await expect(
		wrap('// foo\n// falls through\nbar();\n', { printWidth: 80 })
	).resolves.toBe('// foo falls through\nbar();\n');
	const inputBeforeObjectKey =
		'const foo = {\n// bar falls through\ndefault: 1,\n};\n';

	await expect(wrap(inputBeforeObjectKey, { printWidth: 80 })).resolves.toBe(
		inputBeforeObjectKey
	);
});

test('keeps directives after a TypeScript suppression as line comments', async () => {
	const output = await wrap(
		'// @ts-expect-error\n// eslint-disable-next-line no-console\nfoo();\n',
		{ printWidth: 80 }
	);

	expect(output).toBe(
		'/* @ts-expect-error */\n// eslint-disable-next-line no-console\nfoo();\n'
	);
	await expect(wrap(output, { printWidth: 80 })).resolves.toBe(output);

	const inputAfterEmptyLine =
		'// @ts-ignore\n\n// foo\n// prettier-ignore\nbar();\n';
	const inputAfterBlockComment = '/* baz */\n// prettier-ignore\nqux();\n';
	const inputAfterTrailingSuppression =
		'foo(); // @ts-expect-error\n// prettier-ignore\nbar();\n';
	const inputAfterTrailingBlockSuppression =
		'foo(); /* @ts-ignore */\n// prettier-ignore\nbar();\n';
	const inputAfterBlockSuppression =
		'/*\n * @ts-expect-error */\n// prettier-ignore\nfoo();\n';

	await expect(wrap(inputAfterEmptyLine, { printWidth: 80 })).resolves.toBe(
		'/* @ts-ignore */\n\n// foo\n//\n// prettier-ignore\nbar();\n'
	);
	await expect(
		wrap(inputAfterBlockComment, { printWidth: 80 })
	).resolves.toBe('/* baz */\n/* prettier-ignore */\nqux();\n');
	await expect(
		wrap(inputAfterTrailingSuppression, { printWidth: 80 })
	).resolves.toBe(inputAfterTrailingSuppression);
	await expect(
		wrap(inputAfterBlockSuppression, { printWidth: 80 })
	).resolves.toBe(inputAfterBlockSuppression);
	await expect(
		wrap(inputAfterTrailingBlockSuppression, { printWidth: 80 })
	).resolves.toBe(inputAfterTrailingBlockSuppression);
	await expect(
		wrap('\n// prettier-ignore\nfoo();\n', { printWidth: 80 })
	).resolves.toBe('\n/* prettier-ignore */\nfoo();\n');
});

test('moves directives that follow code onto lines of their own', async () => {
	await expect(
		wrap('const foo = [ // @ts-expect-error\n1,\n];\n', { printWidth: 80 })
	).resolves.toBe('const foo = [ \n/* @ts-expect-error */\n1,\n];\n');
});

test('keeps directives that Prettier would print within a line as line comments', async () => {
	const input = 'const foo = {\n// eslint-disable-next-line\n};\n';
	const inputInTernary =
		'foo = bar\n// eslint-disable-next-line\n? baz\n: qux;\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(input);
	await expect(wrap(inputInTernary, { printWidth: 80 })).resolves.toBe(
		inputInTernary
	);
});

test('keeps directives that ESLint only reads from block comments as written', async () => {
	const input = '// eslint-disable no-console\n// foo\nbar();\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(
		'// eslint-disable no-console\n//\n// foo\nbar();\n'
	);
});

test('keeps directives after more than two slashes as written', async () => {
	const input = '//// @ts-expect-error\nfoo();\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(input);
});

test('keeps an empty line after a directive', async () => {
	const inputAfterSuppression =
		'// @ts-expect-error\n// eslint-disable-next-line no-console\n//\nfoo();\n';
	const inputWithBlockEnd =
		'// eslint-disable-next-line no-console -- bar */\n//\nfoo();\n';

	await expect(
		wrap('// eslint-disable-next-line no-console\n//\nfoo();\n', {
			printWidth: 80,
		})
	).resolves.toBe('/* eslint-disable-next-line no-console */\n//\nfoo();\n');
	await expect(wrap(inputAfterSuppression, { printWidth: 80 })).resolves.toBe(
		'/* @ts-expect-error */\n// eslint-disable-next-line no-console\n//\nfoo();\n'
	);
	await expect(wrap(inputWithBlockEnd, { printWidth: 80 })).resolves.toBe(
		inputWithBlockEnd
	);
});

test('keeps directives that would end a block comment early', async () => {
	await expect(
		wrap('// foo\n// eslint-disable-next-line -- bar */\nbaz();\n')
	).resolves.toBe(
		'// foo\n//\n// eslint-disable-next-line -- bar */\nbaz();\n'
	);
});

test('keeps groups with legal comments as written', async () => {
	const input = '// foo   bar\n//! baz\nqux();\n';
	const inputWithDirective = '//! foo\n// @ts-expect-error\nbar();\n';

	await expect(wrap(input)).resolves.toBe(input);
	await expect(wrap(inputWithDirective)).resolves.toBe(inputWithDirective);
});

test('keeps one empty comment line for a group without text', async () => {
	await expect(wrap('foo();\n//\n//\nbar();\n')).resolves.toBe(
		'foo();\n//\nbar();\n'
	);
});

test('moves the cursor along with a reflowed comment', async () => {
	const input = '// foo\n// ba|r\nbaz();\n';
	const text = input.replace('|', '');
	const options = {
		...(await getParserOptions(text)),
		cursorOffset: input.indexOf('|'),
	};

	const output = await wrapComments(text, 'babel', options);

	expect(output.slice(options.cursorOffset)).toBe('r\nbaz();\n');
});
