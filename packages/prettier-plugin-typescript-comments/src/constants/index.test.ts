import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import { expect, test } from 'vite-plus/test';
import {
	BLOCK_DIRECTIVE_PATTERN,
	COMMENT_SYNTAX,
	FALL_THROUGH_PATTERN,
	LINE_DIRECTIVE_PATTERN,
	RANGE_DIRECTIVE_PATTERN,
	TYPESCRIPT_DIRECTIVE_PATTERN,
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

test('matches directives that tools also read from block comments', () => {
	expect('@jsx h').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@jsxImportSource preact').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@ts-expect-error -- foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@ts-ignore').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('biome-ignore lint: foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('c8 ignore next 3').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('cSpell:disable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable-next-line no-console').toMatch(
		BLOCK_DIRECTIVE_PATTERN
	);
	expect('istanbul ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('node:coverage ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('oxlint-disable-next-line').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('prettier-ignore').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('spell-checker:ignore foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('v8 ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);

	expect('@jsxFoo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable no-console').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disabled').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('foo @ts-ignore').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('prettier-ignore foo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
});

test('matches fall-through comments', () => {
	expect('falls through').toMatch(FALL_THROUGH_PATTERN);
	expect('Intentional fallthrough').toMatch(FALL_THROUGH_PATTERN);
	expect('falling through').not.toMatch(FALL_THROUGH_PATTERN);
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

test('matches directives that ESLint only reads from block comments', () => {
	expect('eslint-disable').toMatch(RANGE_DIRECTIVE_PATTERN);
	expect('eslint-enable no-console').toMatch(RANGE_DIRECTIVE_PATTERN);
	expect('oxlint-disable').toMatch(RANGE_DIRECTIVE_PATTERN);

	expect('eslint-disable-next-line').not.toMatch(RANGE_DIRECTIVE_PATTERN);
	expect('eslint-disabled').not.toMatch(RANGE_DIRECTIVE_PATTERN);
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
	expect(formatComment('// foo bar baz # qux', options)).toBe(
		'// foo bar baz #\n// qux'
	);
	expect(formatComment('// foo bar baz region qux', options)).toBe(
		'// foo bar baz region\n// qux'
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
