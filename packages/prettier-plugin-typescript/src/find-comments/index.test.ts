import type { Options, ParserOptions, Plugin, Printer } from 'prettier';
import { format } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { expect, test, vi } from 'vite-plus/test';
import findComments, { isFindingComments } from './index.ts';

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

async function findCommentTexts(text: string, options: Options = {}) {
	const { comments } = await findComments(
		text,
		'babel',
		await getParserOptions(text, options)
	);

	return comments.map(({ end, indentation, isTrailing, start }) => [
		indentation,
		text.slice(start, end),
		isTrailing,
	]);
}

test('finds comments on lines of their own with their indentation', async () => {
	await expect(
		findCommentTexts(
			'// foo\nfunction bar() {\n// baz\n  if (qux) {\n        // quux\n  }\n}\n',
			{ useTabs: true }
		)
	).resolves.toStrictEqual([
		['', '// foo', false],
		['\t', '// baz', false],
		['\t\t', '// quux', false],
	]);
});

test('finds comments that Prettier moves onto lines of their own', async () => {
	await expect(
		findCommentTexts('const foo = { // bar\n  baz: 1 };\n')
	).resolves.toStrictEqual([['  ', '// bar', false]]);
});

test('finds block comments on lines of their own', async () => {
	await expect(
		findCommentTexts('/* foo */\nfunction bar() {\n/**\n * baz\n */\n}\n')
	).resolves.toStrictEqual([
		['', '/* foo */', false],
		['  ', '/**\n * baz\n */', false],
	]);
	await expect(findCommentTexts('foo();\n/* bar */')).resolves.toStrictEqual([
		['', '/* bar */', false],
	]);
});

test('reports whether Prettier rewrites the lines of trailing comments', async () => {
	const text = 'foo(a, b); // c\n';
	const textWithRewrittenLines = 'foo(a,\n  b); // c\n';
	const textWithCommentInArguments = 'foo(\n  // a\n);\n';

	await expect(
		findComments(text, 'babel', await getParserOptions(text))
	).resolves.toHaveProperty('hasRewrittenLines', false);
	await expect(
		findComments(
			textWithRewrittenLines,
			'babel',
			await getParserOptions(textWithRewrittenLines)
		)
	).resolves.toHaveProperty('hasRewrittenLines', true);
	await expect(
		findComments(
			textWithCommentInArguments,
			'babel',
			await getParserOptions(textWithCommentInArguments)
		)
	).resolves.toHaveProperty('hasRewrittenLines', false);
});

test('finds `//` comments that follow code', async () => {
	await expect(
		findCommentTexts('if (foo) {\n  bar(); // baz\n}\n', { useTabs: true })
	).resolves.toStrictEqual([['\t', '// baz', true]]);
	await expect(
		findCommentTexts('foo(/* bar */); // baz\n')
	).resolves.toStrictEqual([['', '// baz', true]]);
});

test('finds the ranges of JSX elements, JSX text, strings, template text, and block comments', async () => {
	/* oxlint-disable-next-line no-template-curly-in-string */
	const text = "foo('bar', `baz${qux}`, <a>quux</a>);\n/* corge */\n";
	const { jsxElementRanges, jsxTextRanges, textRanges } = await findComments(
		text,
		'babel',
		await getParserOptions(text)
	);

	expect(
		jsxElementRanges.map(({ end, start }) => text.slice(start, end))
	).toStrictEqual(['<a>quux</a>']);
	expect(
		jsxTextRanges.map(({ end, start }) => text.slice(start, end))
	).toStrictEqual(['quux']);
	expect(
		textRanges.map(({ end, start }) => text.slice(start, end)).toSorted()
	).toStrictEqual(['', "'bar'", '/* corge */', 'baz']);
});

test('locates only the nodes whose ranges it records', async () => {
	const { locEnd, locStart } = babelParsers.babel;

	const requireNode =
		(locate: (node: unknown) => number) => (node: { type?: unknown }) => {
			if (typeof node.type !== 'string') {
				throw new TypeError('Expected a node');
			}

			return locate(node);
		};

	const plugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				locEnd: requireNode(locEnd),
				locStart: requireNode(locStart),
			},
		},
	};
	const text = "foo('bar'); // baz\n";
	const options = await getParserOptions(text);
	const { comments } = await findComments(text, 'babel', {
		...options,
		plugins: [plugin],
	});

	expect(
		comments.map(({ end, start }) => text.slice(start, end))
	).toStrictEqual(['// baz']);
});

test('leaves out block comments that share a line with code', async () => {
	await expect(
		findCommentTexts('baz(/* qux */);\n/** @type {T} */ (quux);\n')
	).resolves.toStrictEqual([]);
});

test('finds the code that fall-through comments can precede', async () => {
	const text =
		'switch (foo) {\n  case 1: {\n    break;\n  }\n  default:\n}\nbar = { default: 1 };\n';
	const { fallThroughOffsets } = await findComments(
		text,
		'babel',
		await getParserOptions(text)
	);

	expect([...fallThroughOffsets].toSorted((a, b) => a - b)).toStrictEqual([
		text.indexOf('case'),
		text.indexOf('}'),
		text.indexOf('default'),
	]);
});

test('leaves out comments in code that Prettier prints as written', async () => {
	await expect(
		findCommentTexts('// prettier-ignore\nconst foo = [\n// bar\n  1];\n')
	).resolves.toStrictEqual([['', '// prettier-ignore', false]]);
});

test('leaves out comments in code embedded in the code', async () => {
	await expect(
		findCommentTexts(
			'// foo\nconst bar = html`<script>// baz\nqux();</script>`;\n'
		)
	).resolves.toStrictEqual([['', '// foo', false]]);
});

test('finds no comments in code that holds a mark character', async () => {
	await expect(
		findCommentTexts("const foo = '\u0001';\n// bar\n")
	).resolves.toStrictEqual([]);
});

test('measures marks as zero columns wide', async () => {
	await expect(
		findCommentTexts('const foo = {\n  /* bar */\n};\n')
	).resolves.toStrictEqual([]);
});

test(
	'finds comments in code with a large array',
	{ timeout: 30_000 },
	async () => {
		const text = `const foo = [${'0,'.repeat(150_000)}];\n// bar\n`;
		const options = await getParserOptions('foo();\n');

		const { comments } = await findComments(text, 'babel', options);

		expect(comments).toHaveLength(1);
	}
);

test('keeps the printer’s own preprocessing', async () => {
	const options = await getParserOptions('// foo\n');
	const preprocess = vi.fn((ast: unknown) => ast);

	await findComments('// foo\n', 'babel', {
		...options,
		printer: { ...(options.printer as Printer), preprocess },
	});

	expect(preprocess).toHaveBeenCalledTimes(1);
});

test('finds no comments in code that fails to parse', async () => {
	const options = await getParserOptions('foo();\n');

	await expect(
		findComments('// foo\nbar(\n', 'babel', options)
	).resolves.toStrictEqual({
		comments: [],
		fallThroughOffsets: new Set(),
		hasRewrittenLines: false,
		jsxElementRanges: [],
		jsxTextRanges: [],
		lineEndStarts: new Set(),
		textRanges: [],
	});
});

test('reports whether it’s formatting code to find comments', async () => {
	const states: boolean[] = [];

	const plugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				preprocess: (code) => {
					states.push(isFindingComments());
					return code;
				},
			},
		},
	};

	const options = await getParserOptions('// foo\n');
	await findComments('// foo\n', 'babel', { ...options, plugins: [plugin] });

	expect(states).toStrictEqual([true]);
	expect(isFindingComments()).toBe(false);
});
