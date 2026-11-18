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

	for (const input of [
		'/**\n * @returns foo\n *\n *     bar\n *\n * baz   qux\n */',
		'/**\n * @returns foo\n *\n * - bar\n *     baz\n */',
	]) {
		expect(formatComment(input)).toBe(input);
	}
});

test('keeps indented lines that look like tags as written', () => {
	for (const input of [
		'/**\n * foo\n *\t@param   bar baz\n */',
		'/**\n * foo:\n *\n *     @sealed\n *     class Bar {}\n */',
		'/**\n * @example\n *     @sealed\n *     class Foo {}\n */',
		'/**\n * @param foo   bar\n *\t@param baz qux\n */',
		'/**\n * @param foo   bar\n *     @param baz qux\n *     @param quux corge\n */',
	]) {
		expect(formatComment(input)).toBe(input);
	}
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
	'eslint foo: 1',
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
	for (const input of [
		'/**\n * a | b\n * --- | ---\n * 1 | 2\n * 3 | 4\n */',
		'/**\n * | a | b |\n * |:--|--:|\n * | 1 | 2 |\n */',
		'/**\n * | Name\n * | ---\n * | Foo\n */',
		'/**\n * @returns foo\n *\n *     a | b\n *     --- | ---\n *     1 | 2\n */',
	]) {
		expect(formatComment(input)).toBe(input);
	}

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
	for (const word of ['##', '***', '---', '==', '>', '___']) {
		expect(
			formatComment(`/**\n * foo bar ${word} baz\n */`, {
				printWidth: 11,
			})
		).toBe(`/**\n * foo bar ${word}\n * baz\n */`);
	}
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
