import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import { expect, test } from 'vite-plus/test';
import createCommentSyntax from './index.ts';

function formatComment(
	input: string,
	{ isLeading = false, printWidth = 80 } = {}
): string {
	return formatCommentBlock(input.split('\n'), {
		indentation: '',
		joinLines: true,
		printWidth,
		syntax: createCommentSyntax(isLeading),
		tabWidth: 2,
	}).join('\n');
}

test('keeps words that would read as markup with the word before them', () => {
	const options = { printWidth: 13 };

	expect(formatComment('# foo bar baz #qux quux', options)).toBe(
		'# foo bar baz #qux\n# quux'
	);
	expect(formatComment('# foo bar baz shellcheck qux', options)).toBe(
		'# foo bar baz shellcheck\n# qux'
	);
	expect(formatComment('# foo bar baz shellcheck, qux', options)).toBe(
		'# foo bar baz shellcheck,\n# qux'
	);
	expect(formatComment('# foo bar baz prettier-ignore qux', options)).toBe(
		'# foo bar baz prettier-ignore\n# qux'
	);
	expect(formatComment('# foo bar baz region qux', options)).toBe(
		'# foo bar baz region\n# qux'
	);
	expect(
		formatComment('# foo bar baz SPDX-License-Identifier: MIT', options)
	).toBe('# foo bar baz SPDX-License-Identifier:\n# MIT');
	expect(
		formatComment('# foo bar baz @format qux', {
			...options,
			isLeading: true,
		})
	).toBe('# foo bar baz @format\n# qux');
});

test('keeps the word after a leading marker on its line', () => {
	expect(
		formatComment('# prettier-ignore disables wrapping', { printWidth: 20 })
	).toBe('# prettier-ignore disables\n# wrapping');
	expect(formatComment('# bats foobarbazqux', { printWidth: 12 })).toBe(
		'# bats foobarbazqux'
	);
});

test('keeps directives as written', () => {
	const input = '# shellcheck disable=SC2034,SC2086 # foo bar';

	expect(formatComment(input, { printWidth: 20 })).toBe(input);
});

test('separates directives from the rest of the block', () => {
	expect(formatComment('# foo\n# shellcheck disable=SC2034\n# bar')).toBe(
		'# foo\n#\n# shellcheck disable=SC2034\n#\n# bar'
	);
});

test('treats bare `shellcheck` lines and pragmas as directives', () => {
	const options = { isLeading: true };

	expect(formatComment('# shellcheck\n# foo')).toBe('# shellcheck\n#\n# foo');
	expect(formatComment('# foo\n# @format', options)).toBe(
		'# foo\n#\n# @format'
	);
	expect(formatComment('# foo\n# @prettier', options)).toBe(
		'# foo\n#\n# @prettier'
	);
	expect(formatComment('# - foo\n#   @format', options)).toBe(
		'# - foo\n#\n#   @format'
	);
});

test('treats pragmas as text outside the leading comments', () => {
	expect(formatComment('# foo\n# @format')).toBe('# foo @format');
	expect(formatComment('# foo bar baz @format qux', { printWidth: 13 })).toBe(
		'# foo bar baz\n# @format qux'
	);
});

test('treats other tool directives like `shellcheck` directives', () => {
	expect(formatComment('# foo\n# bats test_tags=slow\n# bar')).toBe(
		'# foo\n#\n# bats test_tags=slow\n#\n# bar'
	);
	expect(formatComment('# bats\n# file_tags=slow')).toBe(
		'# bats\n#\n# file_tags=slow'
	);
	expect(formatComment('# foo\n# bats\tfile_tags=slow')).toBe(
		'# foo\n#\n# bats\tfile_tags=slow'
	);
	expect(formatComment('# foo\n# region Helpers\n# bar\n# endregion')).toBe(
		'# foo\n#\n# region Helpers\n#\n# bar\n#\n# endregion'
	);
	expect(formatComment('# foo\n# dotenv-linter:off')).toBe(
		'# foo\n#\n# dotenv-linter:off'
	);
	expect(formatComment('# SPDX-License-Identifier: MIT\n# foo')).toBe(
		'# SPDX-License-Identifier: MIT\n#\n# foo'
	);
	expect(formatComment('# foo\n# vim: set filetype=sh:')).toBe(
		'# foo\n#\n# vim: set filetype=sh:'
	);
	expect(formatComment('# -*- mode: sh -*-\n# foo')).toBe(
		'# -*- mode: sh -*-\n#\n# foo'
	);
});

test('treats lines that only resemble directives as text', () => {
	expect(formatComment('# foo\n# ex: bar')).toBe('# foo ex: bar');
	expect(formatComment('# foo\n# bats bar')).toBe('# foo bats bar');
});

test('keeps consecutive directives together', () => {
	const input = '# shellcheck disable=SC2034\n# shellcheck source=foo.sh';

	expect(formatComment(input)).toBe(input);
});

test('keeps blocks that contain `prettier-ignore` as written', () => {
	const input = '# prettier-ignore\n## foo   bar\n#\n#';
	const inputWithLaterIgnore = '# foo   bar\n# prettier-ignore\n## baz';
	const inputWithLooseIgnore = '#prettier-ignore\n#\n## foo   bar';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputWithLaterIgnore)).toBe(inputWithLaterIgnore);
	expect(formatComment(inputWithLooseIgnore)).toBe(inputWithLooseIgnore);
});

test('keeps blocks that contain `#!` lines as written', () => {
	const input = '#! foo   bar\n#  baz\n## qux';
	const inputWithLaterLine = '# foo   bar\n#!baz\n# qux';
	const inputWithEmptyFirstLine = '#\n#!/bin/false';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputWithLaterLine)).toBe(inputWithLaterLine);
	expect(formatComment(inputWithEmptyFirstLine)).toBe(
		inputWithEmptyFirstLine
	);
});
