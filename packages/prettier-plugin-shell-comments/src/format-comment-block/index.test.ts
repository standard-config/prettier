import { expect, test } from 'vite-plus/test';
import formatCommentBlock from './index.ts';

function formatComment(
	input: string,
	{ indentation = '', isLeading = false, printWidth = 80, tabWidth = 2 } = {}
): string {
	return formatCommentBlock(input.split('\n'), {
		indentation,
		isLeading,
		printWidth,
		tabWidth,
	}).join('\n');
}

test('fills paragraphs up to the print width', () => {
	expect(
		formatComment('# foo bar baz qux quux corge grault', { printWidth: 20 })
	).toBe('# foo bar baz qux\n# quux corge grault');
});

test('joins lines that end before the print width', () => {
	expect(formatComment('# foo\n# bar\n# baz')).toBe('# foo bar baz');
});

test('counts indentation toward the print width', () => {
	expect(
		formatComment('# foo bar baz qux quux', {
			indentation: '    ',
			printWidth: 20,
		})
	).toBe('# foo bar baz\n# qux quux');
});

test('measures characters by their display width', () => {
	expect(formatComment('# 文字 文字 文字', { printWidth: 12 })).toBe(
		'# 文字 文字\n# 文字'
	);
});

test('advances tabs to the next tab stop', () => {
	expect(
		formatComment('# foo bar baz', {
			indentation: ' \t',
			printWidth: 13,
			tabWidth: 4,
		})
	).toBe('# foo bar\n# baz');
	expect(
		formatComment('#\t- foo bar baz qux', { printWidth: 14, tabWidth: 4 })
	).toBe('#\t- foo bar\n#\t  baz qux');
});

test('collapses whitespace between words', () => {
	expect(formatComment('# foo   bar\tbaz')).toBe('# foo bar baz');
});

test('separates paragraphs with one empty comment line', () => {
	expect(formatComment('# foo\n#\n#\n# bar')).toBe('# foo\n#\n# bar');
});

test('removes empty comment lines at the edges of a block', () => {
	expect(formatComment('#\n# foo\n#')).toBe('# foo');
});

test('keeps one empty comment line for a block without text', () => {
	expect(formatComment('#\n#########')).toBe('#');
});

test('normalizes comment markers', () => {
	expect(formatComment('## foo\n#\n#bar\n#\n#########')).toBe(
		'# foo\n#\n# bar'
	);
	expect(formatComment('#- foo')).toBe('# - foo');
});

test('keeps code spans on one line', () => {
	expect(formatComment('# foo bar baz `qux quux`', { printWidth: 20 })).toBe(
		'# foo bar baz\n# `qux quux`'
	);
});

test('keeps whitespace inside code spans', () => {
	expect(formatComment('# `foo  bar`')).toBe('# `foo  bar`');
});

test('keeps code spans that continue on the next line together', () => {
	expect(
		formatComment('# foo bar baz `qux\n# quux`', { printWidth: 20 })
	).toBe('# foo bar baz\n# `qux quux`');
});

test('treats unmatched backticks as text', () => {
	expect(formatComment('# foo ` bar baz qux quux', { printWidth: 20 })).toBe(
		'# foo ` bar baz qux\n# quux'
	);
});

test('puts words that fit on no line on a line of their own', () => {
	expect(
		formatComment('# foo barbazquxquuxcorgegrault garply', {
			printWidth: 20,
		})
	).toBe('# foo\n# barbazquxquuxcorgegrault\n# garply');
});

test('keeps words that would read as markup with the word before them', () => {
	const options = { printWidth: 13 };

	expect(formatComment('# foo bar baz - qux', options)).toBe(
		'# foo bar baz -\n# qux'
	);
	expect(formatComment('# foo bar baz * qux', options)).toBe(
		'# foo bar baz *\n# qux'
	);
	expect(formatComment('# foo bar baz 1. qux', options)).toBe(
		'# foo bar baz 1.\n# qux'
	);
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
	expect(
		formatComment('# foo bar baz @format qux', {
			...options,
			isLeading: true,
		})
	).toBe('# foo bar baz @format\n# qux');
});

test('keeps the word after a leading `prettier-ignore` on its line', () => {
	expect(
		formatComment('# prettier-ignore disables wrapping', { printWidth: 20 })
	).toBe('# prettier-ignore disables\n# wrapping');
});

test('aligns list item continuation lines with the item text', () => {
	expect(
		formatComment(
			'# - foo bar baz qux quux\n# * corge\n# 10. grault garply waldo fred',
			{ printWidth: 20 }
		)
	).toBe(
		'# - foo bar baz qux\n#   quux\n# * corge\n# 10. grault garply\n#     waldo fred'
	);
});

test('starts list items at markers without text', () => {
	expect(
		formatComment('# -\n# foo bar baz qux quux', { printWidth: 20 })
	).toBe('# - foo bar baz qux\n#   quux');
	expect(formatComment('# 1.')).toBe('# 1.');
});

test('continues list items with the lines that follow them', () => {
	expect(formatComment('# - foo\n# bar\n#   baz')).toBe('# - foo bar baz');
});

test('keeps nested list items indented', () => {
	expect(
		formatComment('# - foo\n#   - bar baz qux', { printWidth: 14 })
	).toBe('# - foo\n#   - bar baz\n#     qux');
});

test('ends list items at empty comment lines', () => {
	expect(formatComment('# - foo\n#\n# bar')).toBe('# - foo\n#\n# bar');
});

test('keeps indented lines as written', () => {
	const input = '# foo:\n#   bar  baz qux quux\n#\tcorge';

	expect(formatComment(input, { printWidth: 10 })).toBe(input);
});

test('starts a paragraph after indented lines', () => {
	expect(formatComment('#   foo\n# bar\n# baz')).toBe('#   foo\n# bar baz');
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
