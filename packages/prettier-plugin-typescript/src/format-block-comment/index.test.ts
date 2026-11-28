import { expect, test } from 'vite-plus/test';
import formatBlockComment from './index.ts';

function formatComment(
	input: string,
	{ indentation = '', printWidth = 80 } = {}
): string | undefined {
	return formatBlockComment(input, { indentation, printWidth, tabWidth: 4 });
}

test('reflows doc comment descriptions', () => {
	expect(
		formatComment('/**\n * foo bar\n * baz qux quux corge\n */', {
			printWidth: 17,
		})
	).toBe('/**\n * foo bar baz\n * qux quux corge\n */');
	expect(formatComment('/**\n * foo\n * bar\n *\n *\n * baz\n */')).toBe(
		'/**\n * foo bar\n *\n * baz\n */'
	);
});

test('opens single-line doc comments into several lines', () => {
	expect(formatComment('/** foo */')).toBe('/**\n * foo\n */');
	expect(formatComment('/** @type {Foo} */')).toBe(
		'/**\n * @type {Foo}\n */'
	);
});

test('formats empty doc comments as one empty line', () => {
	expect(formatComment('/***/')).toBeUndefined();
	expect(formatComment('/** */')).toBe('/**\n *\n */');
	expect(formatComment('/**\n *\n *\n */')).toBe('/**\n *\n */');
});

test('counts the indentation and gutter toward the print width', () => {
	expect(
		formatComment('/** foo bar baz */', {
			indentation: '\t',
			printWidth: 14,
		})
	).toBe('/**\n * foo bar\n * baz\n */');
});

test('indents wrapped tag text by four spaces', () => {
	expect(
		formatComment(
			'/**\n * @param foo bar baz qux\n * quux\n * @returns corge grault\n */',
			{ printWidth: 22 }
		)
	).toBe(
		'/**\n * @param foo bar baz\n *     qux quux\n *\n * @returns corge\n *     grault\n */'
	);
});

test('keeps tag types and names on the first line', () => {
	expect(
		formatComment('/**\n * @param {{ foo: bar }} [baz] - qux\n */', {
			printWidth: 20,
		})
	).toBe('/**\n * @param {{ foo: bar }} [baz] -\n *     qux\n */');
	expect(
		formatComment('/**\n * @typedef {{ foo: bar, baz: qux }} Quux\n */', {
			printWidth: 20,
		})
	).toBe('/**\n * @typedef {{ foo: bar, baz: qux }} Quux\n */');
});

test('keeps tags whose type continues past their line as written', () => {
	const input =
		'/**\n * @typedef {{\n *   id: string,\n *   name: string,\n * }} User\n */';

	expect(formatComment(input, { printWidth: 20 })).toBe(input);
});

test('skips escaped quotes in optional names', () => {
	expect(
		formatComment('/**\n * @param [foo="a\\"]b c"] bar baz\n */', {
			printWidth: 30,
		})
	).toBe('/**\n * @param [foo="a\\"]b c"] bar\n *     baz\n */');
});

test('keeps optional names and type parameter lists on the first line', () => {
	expect(
		formatComment('/**\n * @param [foo="a]b c"] bar baz\n */', {
			printWidth: 20,
		})
	).toBe('/**\n * @param [foo="a]b c"] bar\n *     baz\n */');
	expect(
		formatComment('/**\n * @template Foo, Bar, Baz qux quux\n */', {
			printWidth: 20,
		})
	).toBe('/**\n * @template Foo, Bar, Baz qux\n *     quux\n */');
});

test('keeps tags without a name on one line', () => {
	expect(formatComment('/**\n * @param   {Foo}\n */')).toBe(
		'/**\n * @param {Foo}\n */'
	);
});

test('treats unbalanced type and name brackets as text', () => {
	expect(formatComment('/**\n * @param {foo bar\n */')).toBe(
		'/**\n * @param {foo bar\n */'
	);
	expect(formatComment('/**\n * @param [foo bar\n */')).toBe(
		'/**\n * @param [foo bar\n */'
	);
});

test('separates the description and tags of different kinds', () => {
	expect(
		formatComment(
			'/**\n * foo\n * @param bar\n *\n * @param baz\n * @returns qux\n */'
		)
	).toBe(
		'/**\n * foo\n *\n * @param bar\n * @param baz\n *\n * @returns qux\n */'
	);
});

test('formats content after a tag on a line of its own as a block', () => {
	expect(formatComment('/**\n * @remarks\n * foo\n * bar\n */')).toBe(
		'/**\n * @remarks\n * foo bar\n */'
	);
	expect(formatComment('/**\n * @internal\n */')).toBe(
		'/**\n * @internal\n */'
	);
});

test('ends tag text at an empty line or a list', () => {
	expect(
		formatComment(
			'/**\n * @param foo bar\n *     baz\n *\n *     qux   quux\n * @param corge One of:\n *     - grault\n */'
		)
	).toBe(
		'/**\n * @param foo bar baz\n *\n *     qux quux\n * @param corge One of:\n *     - grault\n */'
	);
});

test('reflows later paragraphs of tag text at the hanging indent', () => {
	expect(
		formatComment(
			'/**\n * @returns foo\n *\n * bar baz qux quux corge grault\n */',
			{ printWidth: 24 }
		)
	).toBe(
		'/**\n * @returns foo\n *\n *     bar baz qux quux\n *     corge grault\n */'
	);
	expect(
		formatComment('/**\n * @returns foo\n *\n * bar\n *\n * baz\n */')
	).toBe('/**\n * @returns foo\n *\n *     bar\n *\n *     baz\n */');
});

test('ends tag text at a code fence with a language', () => {
	const input =
		'/**\n * @returns foo\n * ```ts\n * const bar =   1;\n * ```\n */';

	expect(formatComment(input)).toBe(
		'/**\n * @returns foo\n *     ```ts\n *     const bar =   1;\n *     ```\n */'
	);
});

test('keeps tags in code fences as text', () => {
	const input =
		'/**\n * foo:\n *\n * ````md\n * ```\n * @returns bar\n * ```\n * ````\n */';

	expect(formatComment(input)).toBe(input);
});

test('keeps trailing spaces in examples', () => {
	const input = '/**\n * @example\n * const foo = `bar  \n * baz`;\n */';

	expect(formatComment(input)).toBe(input);
});

test('keeps examples and code fences as written', () => {
	const input =
		'/**\n * foo:\n *\n * ```js\n * @bar\n * baz(  )\n * ```\n *\n * @example\n * qux(  )\n *\n *   quux\n */';

	expect(formatComment(input)).toBe(input);
});

test('reads only words that end at whitespace or a type as tags', () => {
	expect(
		formatComment(
			'/**\n * Shared helpers from\n * @standard-config/utilities.\n */'
		)
	).toBe('/**\n * Shared helpers from @standard-config/utilities.\n */');
	expect(
		formatComment(
			'/**\n * @example\n * @Component({})\n * class Foo {}\n */'
		)
	).toBe('/**\n * @example\n * @Component({})\n * class Foo {}\n */');
	expect(formatComment('/**\n * @param{string} foo\n */')).toBe(
		'/**\n * @param {string} foo\n */'
	);
});

test('keeps relative indentation after the first paragraph of tag text', () => {
	const input =
		'/**\n * @returns foo\n *\n *     ```py\n *     if bar:\n *         baz()\n *     ```\n *\n *     - qux\n *       - quux\n */';

	expect(formatComment(input)).toBe(input);
	expect(
		formatComment('/**\n * @returns foo\n *\n * - bar\n *   - baz\n */')
	).toBe('/**\n * @returns foo\n *\n *     - bar\n *       - baz\n */');
	expect(
		formatComment(
			'/**\n * @returns foo\n * ```ts\n * if (bar) {\n *   baz();\n * }\n * ```\n */'
		)
	).toBe(
		'/**\n * @returns foo\n *     ```ts\n *     if (bar) {\n *       baz();\n *     }\n *     ```\n */'
	);
	expect(
		formatComment(
			'/**\n * @returns foo\n *\n *   bar = 1\n *   baz = 2\n */'
		)
	).toBe('/**\n * @returns foo\n *\n *       bar = 1\n *       baz = 2\n */');
	expect(
		formatComment(
			'/**\n * @returns foo\n *\n * - bar:\n *\n *     ```sh\n *     baz\n *     ```\n */'
		)
	).toBe(
		'/**\n * @returns foo\n *\n * - bar:\n *\n *     ```sh\n *     baz\n *     ```\n */'
	);

	const inputWithGutterParagraph =
		'/**\n * @returns foo\n *\n *     bar\n *\n * baz   qux\n */';
	const inputWithGutterListItem =
		'/**\n * @returns foo\n *\n * - bar\n *     baz\n */';

	expect(formatComment(inputWithGutterParagraph)).toBe(
		inputWithGutterParagraph
	);
	expect(formatComment(inputWithGutterListItem)).toBe(
		inputWithGutterListItem
	);
});

test('keeps indented lines that look like tags as written', () => {
	const input = '/**\n * foo\n *\t@param   bar baz\n */';
	const inputWithDecorator =
		'/**\n * foo:\n *\n *     @sealed\n *     class Bar {}\n */';
	const inputInExample =
		'/**\n * @example\n *     @sealed\n *     class Foo {}\n */';
	const inputInTagText = '/**\n * @param foo   bar\n *\t@param baz qux\n */';
	const inputAtHangingIndent =
		'/**\n * @param foo   bar\n *     @param baz qux\n *     @param quux corge\n */';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputWithDecorator)).toBe(inputWithDecorator);
	expect(formatComment(inputInExample)).toBe(inputInExample);
	expect(formatComment(inputInTagText)).toBe(inputInTagText);
	expect(formatComment(inputAtHangingIndent)).toBe(inputAtHangingIndent);
});

test('keeps tabs after the gutter in content kept as written', () => {
	const input =
		'/**\n * foo:\n *\n * ```js\n *\tif (bar) {\n *\t\tbaz();\n *\t}\n * ```\n *\n * @example\n *\tqux(  );\n */';

	expect(formatComment(input)).toBe(input);
});

test('keeps words that would start a tag with the word before them', () => {
	expect(formatComment('/** foo bar @baz */', { printWidth: 12 })).toBe(
		'/**\n * foo bar @baz\n */'
	);
});

test('reflows block comments with a gutter', () => {
	expect(formatComment('/*\n *\n *\n */')).toBe('/*\n *\n */');
	expect(
		formatComment('/*\n * foo bar baz\n * qux\n */', { printWidth: 13 })
	).toBe('/*\n * foo bar\n * baz qux\n */');
});

test('keeps other block comments as written', () => {
	expect(formatComment('/* foo   bar */')).toBeUndefined();
	expect(formatComment('/*\n  foo   bar\n*/')).toBeUndefined();
	expect(formatComment('/**\n  foo   bar\n */')).toBeUndefined();
	expect(formatComment('/*!\n * foo   bar\n */')).toBeUndefined();
	expect(
		formatComment('/**\n * @license MIT\n * foo   bar\n */')
	).toBeUndefined();
	expect(formatComment('/* @preserve\n * foo   bar\n */')).toBeUndefined();
});

test('keeps banners as written', () => {
	expect(
		formatComment('/*********\n * foo   bar\n *********/')
	).toBeUndefined();
	expect(formatComment('/***\n * foo   bar\n */')).toBeUndefined();
	expect(formatComment('/*\n * foo   bar\n **/')).toBeUndefined();
});

test('keeps TypeScript suppressions on the last line as written', () => {
	expect(
		formatComment('/*\n * foo   bar\n * @ts-expect-error */')
	).toBeUndefined();
	expect(formatComment('/**\n * @ts-ignore -- foo */')).toBeUndefined();
	expect(formatComment('/*\n * foo   bar\n * @ts-ignore\n */')).toBe(
		'/*\n * foo bar @ts-ignore\n */'
	);
});

test.each([
	'@jsxImportSource preact',
	'eslint',
	'eslint foo: 1',
	'eslint foo:',
	'eslint-disable',
	'eslint-disable-next-line foo',
	'eslint-enable',
	'eslint-env node',
	'exported foo',
	'global foo',
	'globals foo',
	'oxlint-disable',
	'oxlint-enable foo',
])('keeps directives that start with %s as written', (directive) => {
	expect(formatComment(`/* ${directive}\n * foo   bar\n */`)).toBeUndefined();
	expect(
		formatComment(`/** ${directive}\n * foo   bar\n */`)
	).toBeUndefined();
});

test('reads directives and pragmas around extra whitespace', () => {
	expect(formatComment('/* prettier-ignore  \n */')).toBeUndefined();
	expect(
		formatComment('/*\teslint-disable\n * foo   bar\n */')
	).toBeUndefined();
	expect(
		formatComment('/**\n * foo   bar\n *\t@format\n */')
	).toBeUndefined();
});

test('keeps active V8 coverage hints as written', () => {
	const docHint = '/** istanbul ignore next\n * foo   bar\n */';
	const literalHint = '/* c8 ignore nextline\n * foo   bar\n */';

	expect(formatComment(docHint)).toBeUndefined();
	expect(formatComment(literalHint)).toBeUndefined();
});

test('reflows prose naming inactive lint directives', () => {
	const input = '/* deno-lint-ignore-file foo\n * bar   baz\n */';

	expect(formatComment(input)).toBe(
		'/*\n * deno-lint-ignore-file foo bar baz\n */'
	);
});

test('keeps an otherwise empty comment with a Semgrep marker on the closing line', () => {
	expect(formatComment('/*\n * nosemgrep */')).toBeUndefined();
});

test('keeps the delimiter after an inline Semgrep marker', () => {
	const input = '/*\n * foo   bar\n * TODO nosemgrep: */';

	expect(formatComment(input)).toBe('/*\n * foo bar\n * TODO nosemgrep: */');
});

test('avoids creating an inline Semgrep marker when collapsing a tab', () => {
	const input =
		'/**\n * foo\tnosemgrep: local.demo\n * bar\n *\n * baz   qux\n */';

	expect(formatComment(input)).toBe(
		'/**\n * foo\tnosemgrep: local.demo\n * bar\n *\n * baz qux\n */'
	);
});

test('reflows prose with an inactive Semgrep mention', () => {
	const input = '/**\n * foo   bar baz qux `nosemgrep` quux\n */';

	expect(formatComment(input, { printWidth: 20 })).toBe(
		'/**\n * foo bar baz qux `nosemgrep`\n * quux\n */'
	);
});

test('reflows prose below a coverage range marker on a plain block comment opener', () => {
	const start = 'start';
	const input = `/* c8 ignore ${start}\n *\n * foo   bar\n */`;

	expect(formatComment(input)).toBe(
		`/* c8 ignore ${start}\n *\n * foo bar\n */`
	);
	expect(formatComment(`/* c8 ignore ${start}\n */`)).toBeUndefined();
});

test('keeps a coverage range marker on its original tag continuation line', () => {
	const stop = 'stop';
	const input = `/**\n * @returns foo bar baz\n * qux v8 ignore ${stop} and quux\n * corge   grault\n */`;

	expect(formatComment(input, { printWidth: 31 })).toBe(
		`/**\n * @returns foo bar baz\n *     qux v8 ignore ${stop} and quux\n *     corge grault\n */`
	);
});

test('keeps Markdown structure after reflowing prose below protected list lines', () => {
	const input = `/**
 * - foo
 *   bar gitleaks:allow
 *   baz gitleaks:allow
 *   qux   quux
 *   > corge gitleaks:allow
 *   grault   garply
 * - waldo
 *   fred gitleaks:allow
 *   plugh   xyzzy
 *       thud   foo
 */`;

	expect(formatComment(input)).toBe(`/**
 * - foo
 *   bar gitleaks:allow
 *   baz gitleaks:allow
 *   qux quux
 *   > corge gitleaks:allow
 *   grault   garply
 * - waldo
 *   fred gitleaks:allow
 *   plugh xyzzy
 *       thud   foo
 */`);
});

test('reflows list prose below a protected lazy continuation', () => {
	const input = `/**
 * - foo
 * bar gitleaks:allow
 *   baz   qux
 */`;

	expect(formatComment(input)).toBe(`/**
 * - foo
 * bar gitleaks:allow
 *   baz qux
 */`);
});

test('keeps code indentation in lists with protected lines', () => {
	const input = `/**
 * -     foo gitleaks:allow
 *       bar   baz
 * - qux gitleaks:allow
 *   quux   corge
 *   \`\`\`text
 *   grault   garply
 *   \`\`\`
 *
 *   waldo   fred
 */`;

	expect(formatComment(input)).toBe(`/**
 * -     foo gitleaks:allow
 *       bar   baz
 * - qux gitleaks:allow
 *   quux corge
 *   \`\`\`text
 *   grault   garply
 *   \`\`\`
 *
 *   waldo   fred
 */`);
});

test('keeps list items and tag text from creating coverage range markers', () => {
	const inputWithList =
		'/**\n * - foo node:coverage ignore\n *   stop\n * - bar   baz\n */';
	const inputWithTag =
		'/**\n * @returns foo c8\n * ignore start\n *\n * bar   baz\n */';
	const inputWithTagBlock =
		'/**\n * @remarks\n * foo c8\n * ignore start\n *\n * bar   baz\n */';

	expect(formatComment(inputWithList)).toBe(
		'/**\n * - foo node:coverage ignore\n *   stop\n * - bar baz\n */'
	);
	expect(formatComment(inputWithTag)).toBe(
		'/**\n * @returns foo c8\n * ignore start\n *\n *     bar baz\n */'
	);
	expect(formatComment(inputWithTagBlock)).toBe(
		'/**\n * @remarks\n * foo c8\n * ignore start\n *\n * bar baz\n */'
	);
});

test.each(['# bar', '* * *', '--', '---', '==', '> bar', 'a | b'])(
	'keeps the Markdown block `%s` on a line of its own',
	(block) => {
		expect(
			formatComment(`/**\n * foo   bar\n * ${block}\n * baz   qux\n */`)
		).toBe(`/**\n * foo bar\n * ${block}\n * baz qux\n */`);
		expect(
			formatComment(`/*\n * foo   bar\n * ${block}\n * baz   qux\n */`)
		).toBe(`/*\n * foo bar\n * ${block}\n * baz qux\n */`);
		expect(
			formatComment(
				`/**\n * @returns foo\n *\n *     bar   baz\n *     ${block}\n */`
			)
		).toBe(
			`/**\n * @returns foo\n *\n *     bar baz\n *     ${block}\n */`
		);
		expect(formatComment(`/**\n * @returns foo\n * ${block}\n */`)).toBe(
			`/**\n * @returns foo\n *     ${block}\n */`
		);
	}
);

test('keeps Markdown table rows on lines of their own', () => {
	const input = '/**\n * a | b\n * --- | ---\n * 1 | 2\n * 3 | 4\n */';
	const inputWithEdgePipes =
		'/**\n * | a | b |\n * |:--|--:|\n * | 1 | 2 |\n */';
	const inputWithOneColumn = '/**\n * | Name\n * | ---\n * | Foo\n */';
	const inputInTag =
		'/**\n * @returns foo\n *\n *     a | b\n *     --- | ---\n *     1 | 2\n */';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputWithEdgePipes)).toBe(inputWithEdgePipes);
	expect(formatComment(inputWithOneColumn)).toBe(inputWithOneColumn);
	expect(formatComment(inputInTag)).toBe(inputInTag);

	expect(
		formatComment(
			'/**\n * foo   bar\n * a | b\n * --- | ---\n * baz   qux\n *\n * quux   corge\n */'
		)
	).toBe(
		'/**\n * foo bar\n * a | b\n * --- | ---\n * baz   qux\n *\n * quux corge\n */'
	);
	expect(formatComment("/**\n * foo\n * 'a' | 'b'\n * bar   baz\n */")).toBe(
		"/**\n * foo\n * 'a' | 'b'\n * bar baz\n */"
	);
	expect(
		formatComment('/**\n * foo   bar:\n * Baz\n * | ---\n * | Qux\n */')
	).toBe('/**\n * foo bar:\n * Baz\n * | ---\n * | Qux\n */');
	expect(
		formatComment(
			'/**\n * @returns foo   bar:\n * Baz\n * | ---\n * | Qux\n */'
		)
	).toBe(
		'/**\n * @returns foo bar:\n *     Baz\n *     | ---\n *     | Qux\n */'
	);
	const tableUnderTag =
		'/**\n * @returns foo bar baz qux\n * | ---\n * | quux\n */';

	expect(formatComment(tableUnderTag, { printWidth: 20 })).toBe(
		tableUnderTag
	);
	expect(
		formatComment(
			'/**\n * ```md\n * | foo |\n * |-----|\n * ```\n * bar   baz\n * qux\n */'
		)
	).toBe(
		'/**\n * ```md\n * | foo |\n * |-----|\n * ```\n * bar baz qux\n */'
	);
	expect(
		formatComment(
			'/**\n * foo `a | b`   bar\n * {@link Baz | baz}   qux\n */'
		)
	).toBe('/**\n * foo `a | b` bar {@link Baz | baz} qux\n */');
});

test('reflows comments around content kept as written', () => {
	expect(
		formatComment(
			"/**\n * Picks the   mode.\n *\n * @param {\n *   | 'a'\n *   | 'b'\n * } mode\n */"
		)
	).toBe(
		"/**\n * Picks the mode.\n *\n * @param {\n *   | 'a'\n *   | 'b'\n * } mode\n */"
	);
	expect(formatComment('/**\n * foo   bar\n *\n *     # baz\n */')).toBe(
		'/**\n * foo bar\n *\n *     # baz\n */'
	);
	expect(
		formatComment('/**\n * foo   bar\n *\n * ```sh\n * # baz\n * ```\n */')
	).toBe('/**\n * foo bar\n *\n * ```sh\n * # baz\n * ```\n */');
	expect(
		formatComment(
			'/**\n * foo   bar\n *\n * @example\n * # baz\n * | qux |\n * |-----|\n */'
		)
	).toBe(
		'/**\n * foo bar\n *\n * @example\n * # baz\n * | qux |\n * |-----|\n */'
	);
	expect(formatComment('/**\n * foo #bar --- baz\n */')).toBe(
		'/**\n * foo #bar --- baz\n */'
	);
});

test('keeps words that would start a Markdown block with the word before them', () => {
	const options = { printWidth: 11 };

	expect(formatComment('/**\n * foo bar ## baz\n */', options)).toBe(
		'/**\n * foo bar ##\n * baz\n */'
	);
	expect(formatComment('/**\n * foo bar *** baz\n */', options)).toBe(
		'/**\n * foo bar ***\n * baz\n */'
	);
	expect(formatComment('/**\n * foo bar --- baz\n */', options)).toBe(
		'/**\n * foo bar ---\n * baz\n */'
	);
	expect(formatComment('/**\n * foo bar == baz\n */', options)).toBe(
		'/**\n * foo bar ==\n * baz\n */'
	);
	expect(formatComment('/**\n * foo bar > baz\n */', options)).toBe(
		'/**\n * foo bar >\n * baz\n */'
	);
	expect(formatComment('/**\n * foo bar ___ baz\n */', options)).toBe(
		'/**\n * foo bar ___\n * baz\n */'
	);
});

test('keeps doc comments with a pragma on any line as written', () => {
	expect(formatComment('/** @format */')).toBeUndefined();
	expect(
		formatComment('/*\n * foo   bar\n * @jsxImportSource preact\n */')
	).toBeUndefined();
	expect(
		formatComment('/**\n * foo\n * @jsx h\n * bar\n */')
	).toBeUndefined();
	expect(
		formatComment('/**\n * foo   bar\n *\n * @format\n * @module baz\n */')
	).toBeUndefined();
});

test('reflows comments that only start like directives', () => {
	expect(formatComment('/* eslint-disabled\n * foo   bar\n */')).toBe(
		'/*\n * eslint-disabled foo bar\n */'
	);
	expect(formatComment('/* globalThis\n * foo   bar\n */')).toBe(
		'/*\n * globalThis foo bar\n */'
	);
});
