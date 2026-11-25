import type { Parser, ParserOptions } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { printers as estreePrinters } from 'prettier/plugins/estree';
import { expect, test } from 'vite-plus/test';
import createParser from './index.ts';

const TEST_SHEBANG = '#!/usr/bin/env node\nfoo(  bar  )';

function createOptions(
	text: string,
	options: Partial<ParserOptions> = {}
): ParserOptions {
	return {
		cursorOffset: -1,
		plugins: [],
		rangeEnd: text.length,
		rangeStart: 0,
		...options,
	} as unknown as ParserOptions;
}

async function preprocess(
	text: string,
	options: ParserOptions = createOptions(text)
): Promise<string> {
	const parser: Parser = createParser('babel', babelParsers.babel);
	const output = await parser.preprocess!(text, options);
	return output;
}

test('adds an empty line after a shebang', async () => {
	await expect(preprocess(TEST_SHEBANG)).resolves.toBe(
		'#!/usr/bin/env node\n\nfoo(  bar  )'
	);
});

test('preserves the syntax error message and location when adding an empty line after a shebang', async () => {
	const input = '#!/usr/bin/env node\nconst foo = ;\n';
	const parser = createParser('babel', babelParsers.babel);
	const options = createOptions(input);
	const errors: unknown[] = [];

	const text = await parser.preprocess!(input, options);

	for (const [parse, code] of [
		[parser.parse, `${text}\n\n`],
		[babelParsers.babel.parse, input],
	] as const) {
		try {
			await parse(code, options);
		} catch (error) {
			errors.push(error);
		}
	}

	expect(text).not.toBe(input);
	expect(errors).toStrictEqual([
		expect.any(SyntaxError),
		expect.any(SyntaxError),
	]);
	expect(errors[0]).toHaveProperty(
		'loc',
		(errors[1] as SyntaxError & { loc: unknown }).loc
	);
	expect((errors[0] as SyntaxError).message).toBe(
		(errors[1] as SyntaxError).message
	);
});

test.each([
	{
		kind: 'a multi-line error',
		error: new SyntaxError('Unexpected token\nExpected an identifier'),
		suffix: ':\n\nUnexpected token\nExpected an identifier',
	},
	{
		kind: 'a string',
		error: 'Unexpected token',
		suffix: ':\n\nUnexpected token',
	},
	{ kind: 'an error with no message', error: new Error(), suffix: '' },
	{ kind: 'null', error: null, suffix: '' },
])(
	'reports a parse failure in the edited code when the parser throws $kind',
	async ({ error, suffix }) => {
		const parser = createParser('babel', {
			...babelParsers.babel,
			parse(text) {
				if (text !== TEST_SHEBANG) {
					throw error;
				}

				return {};
			},
		});
		const options = createOptions(TEST_SHEBANG);
		let result: unknown;

		const text = await parser.preprocess!(TEST_SHEBANG, options);

		try {
			await parser.parse(text, options);
		} catch (caughtError) {
			result = caughtError;
		}

		expect(result).toBeInstanceOf(Error);
		expect(result).not.toHaveProperty('loc');
		expect((result as Error).cause).toBe(error);
		expect((result as Error).message).toBe(
			`[standard-config] Failed to parse the edited code with \`babel\`. The parser accepted the code before Standard Config changed it${suffix}`
		);
	}
);

test('moves the cursor past an added line', async () => {
	const input = '#!/usr/bin/env node\nfoo(|  bar  )';
	const text = input.replace('|', '');
	const options = createOptions(text, { cursorOffset: input.indexOf('|') });

	const output = await preprocess(text, options);

	expect(output.slice(options.cursorOffset as number)).toBe('  bar  )');
});

test('keeps the cursor before an added line in place', async () => {
	const input = '#!|/usr/bin/env node\nfoo(  bar  )';
	const text = input.replace('|', '');
	const options = createOptions(text, { cursorOffset: input.indexOf('|') });

	await preprocess(text, options);

	expect(options.cursorOffset).toBe(input.indexOf('|'));
});

test('leaves a range that starts after the beginning to Prettier', async () => {
	await expect(
		preprocess(TEST_SHEBANG, createOptions(TEST_SHEBANG, { rangeStart: 1 }))
	).resolves.toBe(TEST_SHEBANG);
});

test('leaves a range that ends before the end to Prettier', async () => {
	await expect(
		preprocess(TEST_SHEBANG, createOptions(TEST_SHEBANG, { rangeEnd: 4 }))
	).resolves.toBe(TEST_SHEBANG);
});

test('leaves the selected range Prettier parses again to Prettier', async () => {
	await expect(
		preprocess(
			TEST_SHEBANG,
			createOptions(TEST_SHEBANG, {
				originalText: `${TEST_SHEBANG}\nbaz();\n`,
				rangeEnd: Number.POSITIVE_INFINITY,
			})
		)
	).resolves.toBe(TEST_SHEBANG);
});

test('adds an empty line after a shebang in code embedded in another language', async () => {
	await expect(
		preprocess(
			TEST_SHEBANG,
			createOptions(TEST_SHEBANG, {
				originalText: TEST_SHEBANG,
				rangeEnd: Number.POSITIVE_INFINITY,
			})
		)
	).resolves.toBe('#!/usr/bin/env node\n\nfoo(  bar  )');
});

test('adds an empty line after a shebang when Prettier inserted a pragma', async () => {
	const text = estreePrinters.estree.insertPragma!(TEST_SHEBANG);

	await expect(
		preprocess(
			text,
			createOptions(TEST_SHEBANG, {
				insertPragma: true,
				printer: estreePrinters.estree,
			})
		)
	).resolves.toBe('#!/usr/bin/env node\n\n/** @format */\n\nfoo(  bar  )');
});

test('leaves a range that ends before the end to Prettier when inserting pragmas', async () => {
	const input = '#!/usr/bin/env node\n/** @format */\nfoo(  bar  )\n';

	await expect(
		preprocess(
			input,
			createOptions(input, {
				insertPragma: true,
				printer: estreePrinters.estree,
				rangeEnd: 30,
			})
		)
	).resolves.toBe(input);
});

test('leaves a range that ends before the end to Prettier when requiring pragmas', async () => {
	const text = estreePrinters.estree.insertPragma!(TEST_SHEBANG);

	await expect(
		preprocess(
			text,
			createOptions(TEST_SHEBANG, {
				insertPragma: true,
				printer: estreePrinters.estree,
				requirePragma: true,
			})
		)
	).resolves.toBe(text);
});

test('leaves a range that ends before the end to Prettier without a pragma printer', async () => {
	const text = estreePrinters.estree.insertPragma!(TEST_SHEBANG);

	await expect(
		preprocess(
			text,
			createOptions(TEST_SHEBANG, {
				insertPragma: true,
				printer: { print: () => '' },
			})
		)
	).resolves.toBe(text);
});
