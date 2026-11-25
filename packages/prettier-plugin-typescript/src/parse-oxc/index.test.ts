import type { OxcError, Severity } from 'oxc-parser';
import type { OxcNode } from '../types/index.d.ts';
import { expect, test } from 'vite-plus/test';
import parseOxc, { createSyntaxError } from './index.ts';

test('parses JavaScript as JSX in a module', () => {
	const { comments, program } = parseOxc(
		'<foo />; // bar\n',
		undefined,
		'js'
	);

	expect(program.sourceType).toBe('module');
	expect(comments).toStrictEqual([
		{ end: 15, start: 9, type: 'Line', value: ' bar' },
	]);
});

test('parses code as CommonJS when it isn’t a valid module', () => {
	expect(parseOxc('var await;', undefined, 'js').program.sourceType).toBe(
		'commonjs'
	);
	expect(parseOxc('var await;', undefined, 'ts').program.sourceType).toBe(
		'commonjs'
	);
});

test.each([
	['foo.mjs', 'js'],
	['foo.mts', 'ts'],
	['foo.MJS', 'js'],
] as const)('parses `%s` only as a module', (filepath, language) => {
	expect(parseOxc('foo();', filepath, language).program.sourceType).toBe(
		'module'
	);
	expect(() => parseOxc('var await;', filepath, language)).toThrow(
		SyntaxError
	);
});

test.each([
	['foo.cjs', 'js'],
	['foo.cts', 'ts'],
	['foo.CJS', 'js'],
] as const)('parses `%s` only as CommonJS', (filepath, language) => {
	expect(parseOxc('foo();', filepath, language).program.sourceType).toBe(
		'commonjs'
	);
	expect(() => parseOxc('await foo;', filepath, language)).toThrow(
		SyntaxError
	);
});

test.each(['foo.ts', 'foo.mts', 'foo.cts', 'foo.TS', 'ts', 'mts'])(
	'parses TypeScript in `%s` without JSX',
	(filepath) => {
		expect(() => parseOxc('<any>foo;', filepath, 'ts')).not.toThrow();
		expect(() => parseOxc('<foo />;', filepath, 'ts')).toThrow(SyntaxError);
	}
);

test.each([
	'foo.tsx',
	'foo.TSX',
	'foo.js',
	'foo.mjs',
	'foo.cjs',
	'foo.jsx',
	'foo.JS',
	'js',
	'tsx',
])('parses TypeScript in `%s` with JSX', (filepath) => {
	expect(() => parseOxc('<foo />;', filepath, 'ts')).not.toThrow();
	expect(() => parseOxc('<any>foo;', filepath, 'ts')).toThrow(SyntaxError);
});

test.each([
	'foo.d.ts',
	'foo.d.mts',
	'foo.d.cts',
	'foo.d.css.ts',
	'foo/bar.d.json.ts',
])(
	'parses `%s` as a declaration file, falling back to regular TypeScript',
	(filepath) => {
		expect(() =>
			parseOxc('export const foo: string;', filepath, 'ts')
		).not.toThrow();
		expect(() =>
			parseOxc('function foo() {}', filepath, 'ts')
		).not.toThrow();
		expect(() =>
			parseOxc('export const foo: string;', 'foo.ts', 'ts')
		).toThrow(SyntaxError);
	}
);

test.each([
	undefined,
	'foo.vue',
	'foo.d.css.ts.bak',
	'foo.cjsx',
	'foo.mjsx',
	'foo/ts',
])('parses TypeScript at `%s` with or without JSX', (filepath) => {
	expect(() => parseOxc('<any>foo;', filepath, 'ts')).not.toThrow();
	expect(() => parseOxc('<foo />;', filepath, 'ts')).not.toThrow();
});

test.each([
	['x = <T>y</T>/g;', 'JSXElement'],
	["'z'; x = <T>y</T>/g;", 'TSTypeAssertion'],
	["// </\n'z'; x = <T>y</T>/g;", 'JSXElement'],
	["// '</\n'z'; x = <T>y</T>/g;", 'TSTypeAssertion'],
	["foo; // />\n'z'; x = <T>y</T>/g;", 'JSXElement'],
	["// />\n'z'; x = <T>y</T>/g;", 'TSTypeAssertion'],
	[" // />\n'z'; x = <T>y</T>/g;", 'TSTypeAssertion'],
	["  // />\n'z'; x = <T>y</T>/g;", 'JSXElement'],
	["f\n// />\n'z'; x = <T>y</T>/g;", 'JSXElement'],
	["\n// />\n'z'; x = <T>y</T>/g;", 'TSTypeAssertion'],
	["\n\n// />\n'z'; x = <T>y</T>/g;", 'JSXElement'],
])(
	'parses TypeScript with JSX first when it looks like JSX: %j',
	(input, expectedType) => {
		const { program } = parseOxc(input, 'foo.vue', 'ts');
		const statement = (program.body as OxcNode[]).at(-1)!;
		const assignment = statement.expression as OxcNode;

		expect((assignment.right as OxcNode).left).toHaveProperty(
			'type',
			expectedType
		);
	}
);

test.each([
	'foo.d.css.mts',
	'foo.d.css.cts',
	'foo.D.css.ts',
	'foo.d/bar.ts',
	'a.d.b/foo.ts',
	'foo.D.ts',
	'foo.d.TS',
	'foo.D.TS',
])('parses `%s` as regular TypeScript', (filepath) => {
	expect(() => parseOxc('export const foo: string;', filepath, 'ts')).toThrow(
		SyntaxError
	);
});

test('tries every source type for one language before the next language', () => {
	const { program } = parseOxc("'z'; x = <T>await</T>/g;", 'foo.vue', 'ts');
	const statement = (program.body as OxcNode[]).at(-1)!;
	const assignment = statement.expression as OxcNode;

	expect(program.sourceType).toBe('commonjs');
	expect((assignment.right as OxcNode).left).toHaveProperty(
		'type',
		'TSTypeAssertion'
	);
});

test('rejects TypeScript parse attempts that read `<!--` or `-->` as a line comment', () => {
	expect(() =>
		parseOxc('foo = 1 <!-- bar\nbaz();', 'foo.cts', 'ts')
	).toThrowErrorMatchingInlineSnapshot(
		`[SyntaxError: [prettier-plugin-typescript] Failed to parse TypeScript (1:9). Oxc read \`<!--\` as a line comment where TypeScript expects operators]`
	);
	expect(() =>
		parseOxc('foo = bar\n--> baz', 'foo.cts', 'ts')
	).toThrowErrorMatchingInlineSnapshot(
		`[SyntaxError: [prettier-plugin-typescript] Failed to parse TypeScript (2:1). Oxc read \`-->\` as a line comment where TypeScript expects operators]`
	);
	expect(() =>
		parseOxc('if (foo <!--bar) {}', 'foo.cts', 'ts')
	).toThrowErrorMatchingInlineSnapshot(
		`[SyntaxError: [prettier-plugin-typescript] Failed to parse TypeScript (1:9). Oxc read \`<!--\` as a line comment where TypeScript expects operators]`
	);
	expect(() =>
		parseOxc('var await;\nfoo = 1 <!-- bar', undefined, 'ts')
	).toThrowErrorMatchingInlineSnapshot(
		`[SyntaxError: Cannot use \`await\` as an identifier in an async context (1:5)]`
	);
});

test('reads `<!--` as operators in a TypeScript module', () => {
	const { comments, program } = parseOxc(
		'foo = 1 <!-- bar\nbaz();',
		undefined,
		'ts'
	);

	expect(program.sourceType).toBe('module');
	expect(comments).toStrictEqual([]);
});

test('reads `<!--` and line-leading `-->` as line comments in CommonJS JavaScript', () => {
	const { comments, program } = parseOxc(
		'foo = 1 <!-- bar\n--> baz\nqux();',
		'foo.cjs',
		'js'
	);

	expect(program.sourceType).toBe('commonjs');
	expect(comments).toStrictEqual([
		{ end: 16, start: 8, type: 'Line', value: ' bar' },
		{ end: 24, start: 17, type: 'Line', value: ' baz' },
	]);
});

test('accepts `return` outside of functions', () => {
	expect(parseOxc('return;', 'foo.mjs', 'js').program.sourceType).toBe(
		'module'
	);
});

test('reports the error from the first attempt', () => {
	expect(() =>
		parseOxc("import foo from 'foo';\nvar await;", undefined, 'js')
	).toThrowErrorMatchingInlineSnapshot(
		`[SyntaxError: Cannot use \`await\` as an identifier in an async context (2:5)]`
	);
});

test('converts errors into syntax errors located at their first label', () => {
	const error: OxcError = {
		codeframe: null,
		helpMessage: null,
		labels: [
			{ end: 9, message: null, start: 6 },
			{ end: 1, message: null, start: 0 },
		],
		message: 'Unexpected token\nAdditional detail from Oxc',
		severity: 'Error' as Severity,
	};

	const result = createSyntaxError(error, 'foo\nbarbaz');

	expect(result).toBeInstanceOf(SyntaxError);
	expect(result.message).toBe(
		'Unexpected token (2:3)\nAdditional detail from Oxc'
	);
	expect(result.cause).toBe(error);
	expect(result).toHaveProperty('loc', {
		end: { column: 6, line: 2 },
		start: { column: 3, line: 2 },
	});
});

test.each([
	['\n', 2],
	['\r\n', 2],
	['\r', 2],
	['\u2028', 2],
	['\u2029', 2],
	['\u0085', 1],
	['\v', 1],
	['\f', 1],
])('counts %j as a line break in error locations', (separator, line) => {
	const text = `foo${separator}barbaz`;
	const start = text.indexOf('baz');
	const error: OxcError = {
		codeframe: null,
		helpMessage: null,
		labels: [{ end: start + 3, message: null, start }],
		message: 'Unexpected token',
		severity: 'Error' as Severity,
	};

	const result = createSyntaxError(error, text);

	expect(result).toBeInstanceOf(SyntaxError);
	expect(result).toHaveProperty('loc.start', {
		column: line === 1 ? start + 1 : 4,
		line,
	});
});

test('converts errors without labels into syntax errors without a location', () => {
	const error: OxcError = {
		codeframe: null,
		helpMessage: null,
		labels: [],
		message: 'Unexpected token',
		severity: 'Error' as Severity,
	};

	const result = createSyntaxError(error, 'foo');

	expect(result).toBeInstanceOf(SyntaxError);
	expect(result.message).toBe('Unexpected token');
	expect(result.cause).toBe(error);
	expect(result).not.toHaveProperty('loc');
});
