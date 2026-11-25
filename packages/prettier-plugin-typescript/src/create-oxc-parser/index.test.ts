import type { Options, Parser, Plugin } from 'prettier';
import type { OxcLanguage } from '../types/index.d.ts';
import { visitorKeys } from 'oxc-parser';
import { format, formatWithCursor } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import {
	CURSOR_INPUTS,
	JAVASCRIPT_CASES,
	JAVASCRIPT_SAMPLE,
	OPTION_SETS,
	TYPESCRIPT_CASES,
	TYPESCRIPT_PATH_CASES,
} from '../oxc-parity-cases/index.ts';
import parseOxc from '../parse-oxc/index.ts';
import createOxcParser from './index.ts';

type OxcParserName = keyof typeof REFERENCE_PARSER_NAMES;

const OXC_PARSER_NAMES = ['oxc', 'oxc-ts'] as const;

const PLUGIN: Plugin = {
	parsers: {
		'oxc': createOxcParser('js'),
		'oxc-ts': createOxcParser('ts'),
	},
};

const REFERENCE_PARSER_NAMES = {
	'oxc': 'babel',
	'oxc-ts': 'typescript',
} as const;

// Node types from `oxc-parser` that no case can produce
const SKIPPED_NODE_TYPES: Record<string, string> = {
	V8IntrinsicExpression:
		'`oxc-parser` doesn’t expose the option that parses V8 intrinsics such as `%DebugPrint(a)`',
};

const CASES = [
	...Object.entries(JAVASCRIPT_CASES).flatMap(([group, inputs]) =>
		inputs.flatMap((input) =>
			OXC_PARSER_NAMES.map((parser) => ({ group, input, parser }))
		)
	),
	...Object.entries(TYPESCRIPT_CASES).flatMap(([group, inputs]) =>
		inputs.map((input) => ({
			group,
			input,
			parser: 'oxc-ts' as OxcParserName,
		}))
	),
];

async function formatEach(
	inputs: Record<string, string>,
	options: Options
): Promise<Record<string, string>> {
	const entries = await Promise.all(
		Object.entries(inputs).map(async ([optionSet, input]) => [
			optionSet,
			await format(input, { ...OPTION_SETS[optionSet], ...options }),
		])
	);

	return Object.fromEntries(entries) as Record<string, string>;
}

function getNodeTypes(input: string, language: OxcLanguage): string[] {
	const types: string[] = [];
	const pending: unknown[] = [parseOxc(input, undefined, language).program];

	while (pending.length > 0) {
		const value = pending.pop();

		if (typeof value === 'object' && value !== null) {
			if ('type' in value && typeof value.type === 'string') {
				types.push(value.type);
			}

			pending.push(...Object.values(value));
		}
	}

	return types;
}

function getErrorStart(error: unknown): unknown {
	return (error as SyntaxError & { loc: { start: unknown } }).loc.start;
}

test('creates parsers for Prettier’s `estree` printer with the `babel` parser’s helpers', () => {
	const parser = createOxcParser('js');

	expectTypeOf(parser).toEqualTypeOf<Parser>();
	expect(parser).toStrictEqual({
		astFormat: 'estree',
		hasIgnorePragma: babelParsers.babel.hasIgnorePragma,
		hasPragma: babelParsers.babel.hasPragma,
		locEnd: babelParsers.babel.locEnd,
		locStart: babelParsers.babel.locStart,
		parse: expect.any(Function),
	});
});

test.each(CASES)(
	'formats $group cases like the built-in parser with the `$parser` parser: $input',
	async ({ input, parser }) => {
		const inputs = Object.fromEntries(
			Object.keys(OPTION_SETS).map((optionSet) => [optionSet, input])
		);

		const outputs = await formatEach(inputs, { parser, plugins: [PLUGIN] });

		expect(outputs).toStrictEqual(
			await formatEach(inputs, { parser: REFERENCE_PARSER_NAMES[parser] })
		);
		await expect(
			formatEach(outputs, { parser, plugins: [PLUGIN] })
		).resolves.toStrictEqual(outputs);
	}
);

test.each(TYPESCRIPT_PATH_CASES)(
	'formats TypeScript at $filepath like the built-in parser with the `oxc-ts` parser: $input',
	async ({ filepath, input }) => {
		const inputs = Object.fromEntries(
			Object.keys(OPTION_SETS).map((optionSet) => [optionSet, input])
		);
		const options = { filepath, parser: 'oxc-ts', plugins: [PLUGIN] };

		const outputs = await formatEach(inputs, options);

		expect(outputs).toStrictEqual(
			await formatEach(inputs, { filepath, parser: 'typescript' })
		);
		await expect(formatEach(outputs, options)).resolves.toStrictEqual(
			outputs
		);
	}
);

test('covers every node type that `oxc-parser` can produce', () => {
	const types = new Set([
		...Object.values(JAVASCRIPT_CASES)
			.flat()
			.flatMap((input) => [
				...getNodeTypes(input, 'js'),
				...getNodeTypes(input, 'ts'),
			]),
		...Object.values(TYPESCRIPT_CASES)
			.flat()
			.flatMap((input) => getNodeTypes(input, 'ts')),
	]);

	expect(
		Object.keys(visitorKeys)
			.filter((type) => !types.has(type))
			.toSorted()
	).toStrictEqual(Object.keys(SKIPPED_NODE_TYPES).toSorted());
});

test.each(OXC_PARSER_NAMES)(
	'respects `cursorOffset` at every offset like the built-in parser with the `%s` parser',
	async (parser) => {
		const inputs = CURSOR_INPUTS[parser];

		const formatEachOffset = async (options: Options) =>
			Promise.all(
				inputs.flatMap((input) =>
					Array.from(
						{ length: input.length + 1 },
						async (_, cursorOffset) => {
							const result = await formatWithCursor(input, {
								...options,
								cursorOffset,
							});

							return [result.formatted, result.cursorOffset];
						}
					)
				)
			);

		await expect(
			formatEachOffset({ parser, plugins: [PLUGIN] })
		).resolves.toStrictEqual(
			await formatEachOffset({ parser: REFERENCE_PARSER_NAMES[parser] })
		);
	}
);

test.each(OXC_PARSER_NAMES)(
	'respects `rangeStart` and `rangeEnd` like the built-in parser with the `%s` parser',
	async (parser) => {
		const ranges = [
			[0, 18],
			[20, 62],
			[25, 40],
			[64, JAVASCRIPT_SAMPLE.length],
			[10, 70],
		];

		const formatEachRange = async (options: Options) =>
			Promise.all(
				ranges.map(async ([rangeStart, rangeEnd]) =>
					format(JAVASCRIPT_SAMPLE, {
						...options,
						rangeEnd,
						rangeStart,
					})
				)
			);

		await expect(
			formatEachRange({ parser, plugins: [PLUGIN] })
		).resolves.toStrictEqual(
			await formatEachRange({ parser: REFERENCE_PARSER_NAMES[parser] })
		);
	}
);

test.each(OXC_PARSER_NAMES)(
	'respects pragma options like the built-in parser with the `%s` parser',
	async (parser) => {
		const inputs = [
			['foo( )', { insertPragma: true }],
			['/**\n * @foo\n */\nbar( )', { insertPragma: true }],
			['foo( )', { requirePragma: true }],
			['/** @format */\nfoo( )', { requirePragma: true }],
			['/** @prettier */\nfoo( )', { requirePragma: true }],
			['/** @noformat */\nfoo( )', { checkIgnorePragma: true }],
			['/** @noprettier */\nfoo( )', { checkIgnorePragma: true }],
		] as const;

		const formatEachInput = async (options: Options) =>
			Promise.all(
				inputs.map(async ([input, pragmaOptions]) =>
					format(input, { ...options, ...pragmaOptions })
				)
			);

		await expect(
			formatEachInput({ parser, plugins: [PLUGIN] })
		).resolves.toStrictEqual(
			await formatEachInput({ parser: REFERENCE_PARSER_NAMES[parser] })
		);
	}
);

test.each(OXC_PARSER_NAMES)(
	'reports syntax errors where the built-in parser does with the `%s` parser',
	async (parser) => {
		const inputs = [
			'const foo = ;',
			'foo(',
			'foo;\nbar = (;',
			'foo();\u2028const bar = ;',
			'foo();\u2029const bar = ;',
			'/* foo\u2028bar */ const baz = ;',
		];

		const getErrors = async (options: Options) =>
			Promise.all(
				inputs.map(async (input) => {
					try {
						await format(input, options);
					} catch (error) {
						return error;
					}

					return undefined;
				})
			);

		const errors = await getErrors({ parser, plugins: [PLUGIN] });
		const referenceErrors = await getErrors({
			parser: REFERENCE_PARSER_NAMES[parser],
		});

		expect([...errors, ...referenceErrors]).toStrictEqual(
			[...inputs, ...inputs].map(() => expect.any(SyntaxError))
		);
		expect(errors.map(getErrorStart)).toStrictEqual(
			referenceErrors.map(getErrorStart)
		);
	}
);
