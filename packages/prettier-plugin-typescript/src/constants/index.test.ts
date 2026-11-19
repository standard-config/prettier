import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import { expect, test } from 'vite-plus/test';
import {
	BLOCK_DIRECTIVE_PATTERN,
	COMMENT_SYNTAX,
	CONFIGURATION_COMMENT_PATTERN,
	CONTINUED_DIRECTIVE_PATTERN,
	FALL_THROUGH_PATTERN,
	INDENTED_LINE_PATTERN,
	LINE_DIRECTIVE_PATTERN,
	LIST_DIRECTIVE_PATTERN,
	TYPESCRIPT_DIRECTIVE_PATTERN,
	UNFINISHED_SETTING_PATTERN,
} from './index.ts';

function formatComment(input: string, { printWidth = 80 } = {}): string {
	return formatCommentBlock(input.split('\n'), {
		indentation: '',
		joinLines: true,
		printWidth,
		syntax: COMMENT_SYNTAX,
		tabWidth: 4,
	}).join('\n');
}

test('matches directives that tools read from block comments', () => {
	expect('@jsx h').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@jsxImportSource preact').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@ts-expect-error -- foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@ts-ignore').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('biome-ignore lint: foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('c8 ignore next 3').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('cSpell:disable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint "quotes": [2, "single"]').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect("eslint 'quotes': 2").toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint @typescript-eslint/no-explicit-any: off').toMatch(
		BLOCK_DIRECTIVE_PATTERN
	);
	expect('eslint no-console: off').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable-next-line no-console').toMatch(
		BLOCK_DIRECTIVE_PATTERN
	);
	expect('eslint-enable no-console').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-env node').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('exported foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('global foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('globals foo, bar').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('istanbul ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('node:coverage ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('oxlint-disable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('oxlint-disable-next-line').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('oxlint-enable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('prettier-ignore').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('spell-checker:ignore foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('v8 ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('v8  ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);

	expect('@jsxFoo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint complains about this').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint no-console:').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable-foo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disabled').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-enable-line').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslintrc').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('foo @ts-ignore').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('globalThis.foo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('prettier-ignore foo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
});

test('matches configuration comments', () => {
	expect('eslint').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('eslint no-console: off').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('eslint-env node').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('exported foo').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('global foo').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('globals foo').toMatch(CONFIGURATION_COMMENT_PATTERN);

	expect('eslint-disable foo').not.toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('eslintrc').not.toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('globalThis').not.toMatch(CONFIGURATION_COMMENT_PATTERN);
});

test('joins configuration comments with the paragraph above', () => {
	expect(formatComment('// foo\n// global bar')).toBe('// foo global bar');
	expect(formatComment('// foo\n// eslint bar: off')).toBe(
		'// foo eslint bar: off'
	);
	expect(formatComment('// foo\n// eslint')).toBe('// foo eslint');
});

test('keeps configuration comments after more than two slashes that start a paragraph as written', () => {
	const input = '/// global   foo\n// bar';
	const inputAfterEmptyLine = '// foo\n//\n/// exported   bar\n// baz';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputAfterEmptyLine)).toBe(inputAfterEmptyLine);

	expect(formatComment('// global   foo\n// bar')).toBe('// global foo bar');
});

test('keeps unfinished rule settings that start a paragraph as written', () => {
	const input = '// eslint\n// foo: off';
	const inputAfterDirective = '//#region foo\n// eslint\n// bar: off';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputAfterDirective)).toBe(inputAfterDirective);
});

test('matches directive lines that continue on the next line', () => {
	expect('global foo,').toMatch(CONTINUED_DIRECTIVE_PATTERN);
	expect('eslint quotes:').toMatch(CONTINUED_DIRECTIVE_PATTERN);

	expect('global foo').not.toMatch(CONTINUED_DIRECTIVE_PATTERN);
});

test('matches fall-through comments', () => {
	expect('falls through').toMatch(FALL_THROUGH_PATTERN);
	expect('Intentional fallthrough').toMatch(FALL_THROUGH_PATTERN);
	expect('falling through').not.toMatch(FALL_THROUGH_PATTERN);
});

test('matches indented line comments', () => {
	expect('//  foo').toMatch(INDENTED_LINE_PATTERN);
	expect('//\tfoo').toMatch(INDENTED_LINE_PATTERN);
	expect('///   foo').toMatch(INDENTED_LINE_PATTERN);

	expect('// foo').not.toMatch(INDENTED_LINE_PATTERN);
	expect('//   ').not.toMatch(INDENTED_LINE_PATTERN);
});

test('matches directives that tools only read from line comments', () => {
	expect('#region Validation').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('# sourceMappingURL=index.js.map').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('#\tsourceURL=index.js').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('# debugId=85314830-023f-4cf1-a267-535f4e37bb17').toMatch(
		LINE_DIRECTIVE_PATTERN
	);
	expect('@sourceMappingURL = index.js.map').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('endregion').toMatch(LINE_DIRECTIVE_PATTERN);

	expect('Region').not.toMatch(LINE_DIRECTIVE_PATTERN);
	expect('regional').not.toMatch(LINE_DIRECTIVE_PATTERN);
});

test('matches directives that take lists', () => {
	expect('eslint no-console: off').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-disable foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-enable foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-env node').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('exported foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('global foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('globals foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('oxlint-disable foo').toMatch(LIST_DIRECTIVE_PATTERN);

	expect('@ts-expect-error foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('biome-ignore lint: foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-disable-line foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-disable-next-line foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('globalThis').not.toMatch(LIST_DIRECTIVE_PATTERN);
});

test('matches directives that TypeScript only reads from line comments', () => {
	expect('<reference types="vite/client" />').toMatch(
		TYPESCRIPT_DIRECTIVE_PATTERN
	);
	expect('<REFERENCE types="vite/client" />').toMatch(
		TYPESCRIPT_DIRECTIVE_PATTERN
	);
	expect('@ts-check').toMatch(TYPESCRIPT_DIRECTIVE_PATTERN);
	expect('@TS-NOCHECK').toMatch(TYPESCRIPT_DIRECTIVE_PATTERN);

	expect('@ts-checked').not.toMatch(TYPESCRIPT_DIRECTIVE_PATTERN);
});

test('keeps directives that tools only read from line comments as written', () => {
	expect(formatComment('// foo\n//#region   Validation\n// bar')).toBe(
		'// foo\n//\n//#region   Validation\n//\n// bar'
	);
	expect(formatComment('/// <reference types="vite/client" />')).toBe(
		'/// <reference types="vite/client" />'
	);
});

test('keeps words that would start a directive with the word before them', () => {
	const options = { printWidth: 15 };

	expect(formatComment('// foo bar baz @ts-ignore qux', options)).toBe(
		'// foo bar baz @ts-ignore\n// qux'
	);
	expect(formatComment('// foo bar baz c8 ignore', options)).toBe(
		'// foo bar baz c8\n// ignore'
	);
	expect(formatComment('// foo bar baz eslint qux', options)).toBe(
		'// foo bar baz eslint\n// qux'
	);
	expect(formatComment('// foo bar baz # qux', options)).toBe(
		'// foo bar baz #\n// qux'
	);
	expect(formatComment('// foo bar baz pragma: qux', options)).toBe(
		'// foo bar baz pragma:\n// qux'
	);
	expect(formatComment('// foo bar baz pragma:allowlist qux', options)).toBe(
		'// foo bar baz pragma:allowlist\n// qux'
	);
	expect(formatComment('// foo bar baz region qux', options)).toBe(
		'// foo bar baz region\n// qux'
	);
});

test('keeps lines from joining into a directive', () => {
	const options = { printWidth: 20 };

	expect(formatComment('// c8\n// ignore next', options)).toBe(
		'// c8\n// ignore next'
	);
	expect(
		formatComment('// pragma:\n// allowlist nextline secret', options)
	).toBe('// pragma:\n// allowlist nextline secret');
	expect(formatComment('// pragma:\n// allowlist\n// nextline secret')).toBe(
		'// pragma: allowlist\n// nextline secret'
	);
	expect(
		formatComment('// pragma:  allowlist\n// nextline secret', options)
	).toBe('// pragma: allowlist\n// nextline secret');
	expect(formatComment('// #\n// sourceMappingURL=foo.js', options)).toBe(
		'// #\n// sourceMappingURL=foo.js'
	);
});

test('keeps lines as written when collapsing their spaces would form a directive', () => {
	expect(formatComment('// pragma:  allowlist nextline secret')).toBe(
		'// pragma:  allowlist nextline secret'
	);
});

test('keeps blocks with legal comments as written', () => {
	const input = '//! foo   bar\n// baz';
	const inputWithLicense = '// foo   bar\n// @license MIT';
	const inputWithPreserve = '// @preserve\n//foo';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputWithLicense)).toBe(inputWithLicense);
	expect(formatComment(inputWithPreserve)).toBe(inputWithPreserve);
});

test('matches unfinished rule settings', () => {
	expect('eslint').toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint "quotes"').toMatch(UNFINISHED_SETTING_PATTERN);
	expect("eslint 'quotes':").toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint no-console').toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint no-console:').toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint "no-').toMatch(UNFINISHED_SETTING_PATTERN);
	expect("eslint 'no-").toMatch(UNFINISHED_SETTING_PATTERN);

	expect('eslint complains about this').not.toMatch(
		UNFINISHED_SETTING_PATTERN
	);
	expect('eslint "no-console" off').not.toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint no-console: off').not.toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint-disable').not.toMatch(UNFINISHED_SETTING_PATTERN);
});
