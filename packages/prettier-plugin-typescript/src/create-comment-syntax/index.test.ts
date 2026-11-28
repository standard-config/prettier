import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import { expect, test } from 'vite-plus/test';
import createCommentSyntax from './index.ts';

function formatComment(input: string, { printWidth = 80 } = {}): string {
	return formatCommentBlock(input.split('\n'), {
		indentation: '',
		printWidth,
		syntax: createCommentSyntax(),
		tabWidth: 4,
	}).join('\n');
}

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
	expect(
		formatComment('// foo bar baz pragma:allowlist-secret', options)
	).toBe('// foo bar baz pragma:allowlist-secret');
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
		formatComment('// pragma:\n// allowlist nextline secret', {
			printWidth: 40,
		})
	).toBe('// pragma:\n// allowlist nextline secret');
	expect(
		formatComment('// pragma:\n// allowlist\n// nextline secret', options)
	).toBe('// pragma: allowlist\n// nextline secret');
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
