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

async function wrap(
	text: string,
	{ tsCommentWrap, ...options }: Options = {}
): Promise<string> {
	const parserOptions = await getParserOptions(text, {
		printWidth: 14,
		...options,
	});

	return wrapComments(text, 'babel', { ...parserOptions, tsCommentWrap });
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
	await expect(
		wrap('// @ts-expect-error foo,\n// bar\nbaz();\n', { printWidth: 80 })
	).resolves.toBe('/* @ts-expect-error foo, */\n// bar\nbaz();\n');
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
		'/* @ts-ignore */\n\n// foo\n// prettier-ignore\nbar();\n'
	);
	await expect(
		wrap(inputAfterBlockComment, { printWidth: 80 })
	).resolves.toBe('/* baz */\n/* prettier-ignore */\nqux();\n');
	await expect(
		wrap(inputAfterTrailingSuppression, { printWidth: 80 })
	).resolves.toBe(
		'foo(); /* @ts-expect-error */\n// prettier-ignore\nbar();\n'
	);
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

test('reflows configuration comments that stay line comments', async () => {
	await expect(
		wrap('// @ts-expect-error\n// foo\n// global bar\nbaz();\n', {
			printWidth: 80,
		})
	).resolves.toBe('/* @ts-expect-error */\n// foo global bar\nbaz();\n');
	await expect(
		wrap('// @ts-expect-error\n// global foo\n// bar\nbaz();\n', {
			printWidth: 80,
		})
	).resolves.toBe('/* @ts-expect-error */\n// global foo bar\nbaz();\n');
	await expect(
		wrap('/// foo\n/// global bar\nbaz();\n', { printWidth: 80 })
	).resolves.toBe('// foo global bar\nbaz();\n');

	const output = await wrap('/// global foo\n/// bar\nbaz();\n', {
		printWidth: 80,
	});

	expect(output).toBe('/// global foo\n// bar\nbaz();\n');
	await expect(wrap(output, { printWidth: 80 })).resolves.toBe(output);
});

test('moves directives that follow code onto lines of their own', async () => {
	await expect(
		wrap('const foo = [ // @ts-expect-error\n1,\n];\n', { printWidth: 80 })
	).resolves.toBe('const foo = [ \n/* @ts-expect-error */\n1,\n];\n');
});

test('keeps directives that Prettier would print within a line as line comments', async () => {
	const input = 'const foo = {\n// eslint-disable-next-line\n};\n';
	const inputWithRangeDirective = 'const foo = {\n// eslint-disable\n};\n';
	const inputInTernary =
		'foo = bar\n// eslint-disable-next-line\n? baz\n: qux;\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(input);
	await expect(
		wrap(inputWithRangeDirective, { printWidth: 80 })
	).resolves.toBe(inputWithRangeDirective);
	await expect(
		wrap(inputInTernary, { printWidth: 80, tsCommentWrap: 'full-line' })
	).resolves.toBe(inputInTernary);
});

test('wraps comments in formatted code when Prettier rewrites their lines', async () => {
	await expect(
		wrap('foo(a,\n  b); // c\n', { printWidth: 80 })
	).resolves.toBe('// c\nfoo(a, b);\n');
	await expect(
		wrap('foo(a,\n  b); // c\n', {
			printWidth: 80,
			tsCommentWrap: 'full-line',
		})
	).resolves.toBe('foo(a,\n  b); // c\n');
});

test('turns directives that ESLint only reads from block comments into block comments', async () => {
	const input = '// eslint-disable no-console\n// foo\nbar();\n';
	const inputWithConfiguration =
		'// eslint-env node\n// global foo\n// bar\nbaz();\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(
		'/* eslint-disable no-console */\n// foo\nbar();\n'
	);
	await expect(
		wrap(inputWithConfiguration, { printWidth: 80 })
	).resolves.toBe(
		'/* eslint-env node */\n/* global foo */\n// bar\nbaz();\n'
	);
	await expect(
		wrap("// eslint 'no-console': off\nfoo();\n", { printWidth: 80 })
	).resolves.toBe("/* eslint 'no-console': off */\nfoo();\n");
	await expect(
		wrap("// eslint quotes: ['error', '[{']\n// bar\nbaz();\n", {
			printWidth: 80,
		})
	).resolves.toBe("/* eslint quotes: ['error', '[{'] */\n// bar\nbaz();\n");
	await expect(
		wrap(
			'// eslint quotes: ["error", "[{", { avoidEscape: true }]\n// bar\nbaz();\n',
			{ printWidth: 80 }
		)
	).resolves.toBe(
		'/* eslint quotes: ["error", "[{", { avoidEscape: true }] */\n// bar\nbaz();\n'
	);
	await expect(
		wrap(
			'// eslint-disable no-console -- foo,\n// bar\nconsole.log(baz);\n',
			{ printWidth: 80 }
		)
	).resolves.toBe(
		'/* eslint-disable no-console -- foo, */\n// bar\nconsole.log(baz);\n'
	);
	await expect(
		wrap(
			'// eslint-disable no-console, -- foo\n// bar\nconsole.log(baz);\n',
			{ printWidth: 80 }
		)
	).resolves.toBe(
		'/* eslint-disable no-console, -- foo */\n// bar\nconsole.log(baz);\n'
	);
	await expect(
		wrap(
			"// eslint-disable no-console -- see [the logger's docs]\n// bar\nconsole.log(baz);\n",
			{ printWidth: 80 }
		)
	).resolves.toBe(
		"/* eslint-disable no-console -- see [the logger's docs] */\n// bar\nconsole.log(baz);\n"
	);
	await expect(
		wrap('// eslint-disable no-console,\nconsole.log(foo);\n', {
			printWidth: 80,
		})
	).resolves.toBe('/* eslint-disable no-console, */\nconsole.log(foo);\n');
});

test('keeps directive lists that continue on the next line as written', async () => {
	const inputWithContinuedSetting =
		"// eslint 'no-console': off,\n//   'no-undef': off\nfoo();\n";
	const inputWithOpenSetting =
		'// eslint quotes: [\n//   "error",\n// ]\nfoo();\n';
	const inputWithOpenObject =
		'// eslint quotes: ["error", { avoidEscape: true\n// }]\nfoo();\n';
	const inputWithClosedObject =
		'// eslint quotes: ["error", { avoidEscape: true }\n// ]\nfoo();\n';
	const inputWithColon = '// eslint semi: off, quotes:\n// off\nfoo();\n';
	const inputWithContinuedGlobals =
		'// global foo,\n// global bar,\n// baz\n// qux quux\n// corge\ngrault();\n';
	const inputBelowTrailingSetting =
		'foo(); // eslint no-console: off,\n// no-undef: off\n// bar\nbaz();\n';
	const inputAfterParagraph = '// foo\n//\n// global bar,\n// baz\nqux();\n';
	const inputBelowBlockComment =
		'/* eslint-disable foo */\n//\n// global bar,\n// baz\nqux();\n';
	const inputWithIndentedList =
		'// eslint-disable\n//   no-console,\n//   no-undef\nfoo();\n';
	const inputWithSpacedGlobals = '// global foo\n//   bar\nbaz();\n';
	const inputBelowTrailingGlobals =
		'foo(); // global bar\n//   baz\nqux();\n';
	const inputBeforeCase =
		'switch (foo) {\ncase 1:\n// bar\n// global baz,\n// falls through\ncase 2:\n}\n';

	await expect(
		wrap(inputWithContinuedSetting, { printWidth: 80 })
	).resolves.toBe(inputWithContinuedSetting);
	await expect(wrap(inputWithOpenSetting, { printWidth: 80 })).resolves.toBe(
		inputWithOpenSetting
	);
	await expect(wrap(inputWithOpenObject, { printWidth: 80 })).resolves.toBe(
		inputWithOpenObject
	);
	await expect(wrap(inputWithClosedObject, { printWidth: 80 })).resolves.toBe(
		inputWithClosedObject
	);
	await expect(wrap(inputWithColon, { printWidth: 80 })).resolves.toBe(
		inputWithColon
	);
	await expect(
		wrap(inputWithContinuedGlobals, { printWidth: 80 })
	).resolves.toBe(inputWithContinuedGlobals);
	await expect(
		wrap(inputBelowTrailingSetting, { printWidth: 80 })
	).resolves.toBe(inputBelowTrailingSetting);
	await expect(wrap(inputAfterParagraph, { printWidth: 80 })).resolves.toBe(
		inputAfterParagraph
	);
	await expect(
		wrap(inputBelowBlockComment, { printWidth: 80 })
	).resolves.toBe(inputBelowBlockComment);
	await expect(wrap(inputBeforeCase, { printWidth: 80 })).resolves.toBe(
		inputBeforeCase
	);
	await expect(wrap(inputWithIndentedList, { printWidth: 80 })).resolves.toBe(
		inputWithIndentedList
	);
	await expect(
		wrap(inputWithSpacedGlobals, { printWidth: 80 })
	).resolves.toBe(inputWithSpacedGlobals);
	await expect(
		wrap(inputBelowTrailingGlobals, { printWidth: 80 })
	).resolves.toBe(inputBelowTrailingGlobals);
	await expect(
		wrap(
			'// eslint-disable no-console\n// global foo,\n//   bar\nbaz();\n',
			{ printWidth: 80 }
		)
	).resolves.toBe(
		'/* eslint-disable no-console */\n// global foo,\n//   bar\nbaz();\n'
	);
	await expect(
		wrap('// eslint-disable foo\n//\n// global bar,\n// baz\nqux();\n', {
			printWidth: 80,
		})
	).resolves.toBe(inputBelowBlockComment);
	await expect(
		wrap(
			'// foo\n// ```\n// global bar,\n// baz\n// ```\n// qux\n// quux\ncorge();\n',
			{ printWidth: 80 }
		)
	).resolves.toBe(
		'// foo\n// ```\n// global bar,\n// baz\n// ```\n// qux quux\ncorge();\n'
	);
});

test('formats the comments below single-line directives that end with a comma', async () => {
	await expect(
		wrap('foo(); // eslint-disable-line bar,\n// baz\n// qux\nquux();\n', {
			printWidth: 80,
		})
	).resolves.toBe(
		'foo(); /* eslint-disable-line bar, */\n// baz qux\nquux();\n'
	);
});

test('keeps unfinished rule settings as written', async () => {
	const input = '// eslint\n// no-console: off\nfoo();\n';
	const inputWithColon = '// eslint no-console:\n// off\nfoo();\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(input);
	await expect(wrap(inputWithColon, { printWidth: 80 })).resolves.toBe(
		inputWithColon
	);
});

test('reflows prose that starts with `eslint`', async () => {
	await expect(
		wrap('// eslint complains about this,\n// so foo\nbar();\n', {
			printWidth: 80,
		})
	).resolves.toBe('// eslint complains about this, so foo\nbar();\n');
	await expect(
		wrap('// foo\n// eslint bar\nbaz();\n', { printWidth: 80 })
	).resolves.toBe('// foo eslint bar\nbaz();\n');
});

test('keeps lines from joining into a directive', async () => {
	const input = '// c8\n// ignore next\nfoo();\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(input);
});

test('keeps directives in code fences as written', async () => {
	const input =
		'switch (foo) {\ncase 1:\n// ```js\n// eslint-disable-next-line\n// bar  baz\n// falls through\n// ```\ncase 2:\n}\n';

	await expect(wrap(input, { printWidth: 80 })).resolves.toBe(input);

	const inputInUnclosedFence =
		'switch (foo) {\ncase 1:\n// ```\n// bar  baz\n// falls through\ncase 2:\n}\n';

	await expect(wrap(inputInUnclosedFence, { printWidth: 80 })).resolves.toBe(
		inputInUnclosedFence
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
	await expect(
		wrap('// v8  ignore next\n//\nfoo();\n', { printWidth: 80 })
	).resolves.toBe('/* v8  ignore next */\n//\nfoo();\n');
	await expect(wrap(inputAfterSuppression, { printWidth: 80 })).resolves.toBe(
		'/* @ts-expect-error */\n// eslint-disable-next-line no-console\n//\nfoo();\n'
	);
	await expect(wrap(inputWithBlockEnd, { printWidth: 80 })).resolves.toBe(
		inputWithBlockEnd
	);
});

test('keeps the line below a directive that covers it as written', async () => {
	const input =
		'// cspell:disable-next-line\n// foo bar baz qux\n// quux\ncorge();\n';
	const inputBelowBlockComment =
		'/* cspell:disable-next-line */\n// foo bar baz qux\n// quux\ncorge();\n';
	const inputWithEmptyLine =
		'// cspell:disable-next-line\n//\n// foo bar\n// baz\nqux();\n';
	const inputBelowIgnoreMarker =
		'/* prettier-ignore */\n// foo bar\n// baz\nqux();\n';

	await expect(wrap(input)).resolves.toBe(
		'/* cspell:disable-next-line */\n// foo bar baz qux\n// quux\ncorge();\n'
	);
	await expect(wrap(inputBelowBlockComment)).resolves.toBe(
		inputBelowBlockComment
	);
	await expect(wrap(inputWithEmptyLine)).resolves.toBe(
		'/* cspell:disable-next-line */\n//\n// foo bar baz\nqux();\n'
	);
	await expect(
		wrap('// prettier-ignore\n// foo bar\n// baz\nqux();\n')
	).resolves.toBe(inputBelowIgnoreMarker);
	await expect(wrap(inputBelowIgnoreMarker)).resolves.toBe(
		inputBelowIgnoreMarker
	);
});

test('keeps directives that would end a block comment early', async () => {
	await expect(
		wrap('// foo\n// eslint-disable-next-line -- bar */\nbaz();\n')
	).resolves.toBe('// foo\n// eslint-disable-next-line -- bar */\nbaz();\n');
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

test('separates moved comments from the `//` comments above them', async () => {
	await expect(wrap('// foo\nbar(); // baz\n')).resolves.toBe(
		'// foo\n//\n// baz\nbar();\n'
	);
	await expect(wrap('if (foo) { // bar\nbaz(); // qux\n}\n')).resolves.toBe(
		'if (foo) { // bar\n//\n// qux\nbaz();\n}\n'
	);
	await expect(wrap('//#region\n//\nfoo(); // bar\n')).resolves.toBe(
		'//#region\n//\n// bar\nfoo();\n'
	);
});

test('joins moved comments with the empty comment lines above them', async () => {
	await expect(wrap('//\nfoo(); // bar\n')).resolves.toBe('// bar\nfoo();\n');
	await expect(wrap('// @jsx h\nfoo(); // bar\n')).resolves.toBe(
		'/* @jsx h */\n// bar\nfoo();\n'
	);
	await expect(wrap('// @jsx h\n//\nfoo(); // bar\n')).resolves.toBe(
		'/* @jsx h */\n// bar\nfoo();\n'
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

test('formats block comments on lines of their own', async () => {
	await expect(wrap('/** foo bar baz qux */\nquux();\n')).resolves.toBe(
		'/**\n * foo bar baz\n * qux\n */\nquux();\n'
	);
});

test('keeps block comments that stay as written', async () => {
	const input = '/* foo   bar */\nbaz();\n';

	await expect(wrap(input)).resolves.toBe(input);
});
