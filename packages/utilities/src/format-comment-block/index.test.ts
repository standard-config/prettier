import type { CommentSyntax } from '../types/index.d.ts';
import { expect, test } from 'vite-plus/test';
import formatCommentBlock, {
	fillCommentText,
	findFencedLines,
} from './index.ts';

const TEST_SYNTAX: CommentSyntax = {
	isBlockKept: (line) => line.startsWith('#!') || /^#[ \t]*kept$/.test(line),
	isDirective: (text) => /^(?:directive|marker$|split line\b)/.test(text),
	isLineKept: (texts, index) =>
		texts[index]!.startsWith('| ') ||
		texts.slice(0, index).includes('| kept'),
	isUnsafeLineStart: (word) => word === 'directive' || word === 'marker',
	isUnsafeParagraphStart: (line) => /^##[ \t]*opener/.test(line),
	marker: '#',
};

function formatComment(
	input: string,
	{
		indentation = '',
		joinLines = true,
		printWidth = 80,
		syntax = TEST_SYNTAX,
		tabWidth = 2,
	} = {}
): string {
	return formatCommentBlock(input.split('\n'), {
		indentation,
		joinLines,
		printWidth,
		syntax,
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

test('normalizes comment markers of more than one character', () => {
	const syntax = { ...TEST_SYNTAX, marker: '//' };

	expect(formatComment('//// foo\n//\n///bar\n/////', { syntax })).toBe(
		'// foo\n//\n// bar'
	);
	expect(formatComment('//- foo', { syntax })).toBe('// - foo');
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

test('keeps inline tags on one line', () => {
	expect(
		formatComment('# foo bar baz {@link qux | quux}', { printWidth: 20 })
	).toBe('# foo bar baz\n# {@link qux | quux}');
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
	expect(formatComment('# foo bar baz + qux', options)).toBe(
		'# foo bar baz +\n# qux'
	);
	expect(formatComment('# foo bar baz 1. qux', options)).toBe(
		'# foo bar baz 1.\n# qux'
	);
	expect(formatComment('# foo bar baz 1) qux', options)).toBe(
		'# foo bar baz 1)\n# qux'
	);
	expect(formatComment('# foo bar baz directive qux', options)).toBe(
		'# foo bar baz directive\n# qux'
	);
});

test('keeps the word after a leading marker on its line', () => {
	expect(formatComment('# marker foobarbazqux', { printWidth: 12 })).toBe(
		'# marker foobarbazqux'
	);
	expect(formatComment('# kept foobarbazqux', { printWidth: 12 })).toBe(
		'# kept foobarbazqux'
	);
});

test('detects directives after the same whitespace as when parsing', () => {
	expect(
		formatComment('# \u00A0directive foo bar baz', { printWidth: 13 })
	).toBe('# \u00A0directive\n# foo bar baz');
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

test('starts list items at `+` and `N)` markers', () => {
	expect(
		formatComment('# + foo bar baz qux\n# 1) quux', { printWidth: 14 })
	).toBe('# + foo bar\n#   baz qux\n# 1) quux');
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

test('keeps lines that the syntax keeps as written on lines of their own', () => {
	for (const input of [
		'# foo\n# | bar   baz |\n# qux',
		'# - foo\n# | bar |',
		'# | kept\n# foo   bar',
		'# directive foo\n# | bar |\n# directive baz',
	]) {
		expect(formatComment(input)).toBe(input);
	}

	expect(formatComment('# ```\n# | kept\n# ```\n# foo   bar')).toBe(
		'# ```\n# | kept\n# ```\n# foo bar'
	);
});

test('keeps lines that the syntax can’t start a paragraph with as written', () => {
	for (const input of [
		'## opener   foo\n# bar',
		'# foo\n#\n## opener   bar\n# baz',
		'#   foo\n## opener   bar\n# baz',
	]) {
		expect(formatComment(input)).toBe(input);
	}

	expect(formatComment('# opener   foo\n# bar')).toBe('# opener foo bar');
	expect(formatComment('# foo\n## opener   bar\n# baz')).toBe(
		'# foo opener bar baz'
	);
	expect(formatComment('# - foo\n## opener   bar')).toBe(
		'# - foo opener bar'
	);
});

test('keeps directives as written', () => {
	const input = '# directive foo   bar baz qux quux';

	expect(formatComment(input, { printWidth: 20 })).toBe(input);
});

test('keeps lines from joining into a directive', () => {
	expect(formatComment('# split\n# line   foo\n# bar   baz')).toBe(
		'# split\n# line   foo\n# bar baz'
	);
	expect(formatComment('# split \n# line')).toBe('# split\n# line');
	expect(formatComment('# not split\n# line')).toBe('# not split line');
	expect(formatComment('# split\n# foo\n# line')).toBe('# split foo line');
});

test('keeps lines as written when collapsing their spaces would form a directive', () => {
	expect(formatComment('# split   line')).toBe('# split   line');
});

test('separates directives from the rest of the block', () => {
	expect(formatComment('# foo\n# directive\n# bar')).toBe(
		'# foo\n#\n# directive\n#\n# bar'
	);
	expect(formatComment('# - foo\n#   directive')).toBe(
		'# - foo\n#\n#   directive'
	);
});

test('keeps consecutive directives together', () => {
	const input = '# directive foo\n# directive bar';

	expect(formatComment(input)).toBe(input);
});

test('keeps blocks as written when the syntax requires it', () => {
	const input = '# foo   bar\n#!baz\n## qux';

	expect(formatComment(input)).toBe(input);
});

test('keeps code fences as written', () => {
	const input =
		'# foo:\n#\n# ```sh\n# bar  baz\n#\n#\n# qux\n# ```\n# quux\n# corge';

	expect(formatComment(input)).toBe(
		'# foo:\n#\n# ```sh\n# bar  baz\n#\n#\n# qux\n# ```\n# quux corge'
	);
});

test('ends code fences at a closing marker at least as long', () => {
	expect(formatComment('# ~~~~\n# ~~~\n# foo\n# ~~~~~\n# bar\n# baz')).toBe(
		'# ~~~~\n# ~~~\n# foo\n# ~~~~~\n# bar baz'
	);
});

test('ends code fences only at the marker character that opened them', () => {
	expect(formatComment('# ~~~\n# ```\n# foo\n# ~~~\n# bar\n# baz')).toBe(
		'# ~~~\n# ```\n# foo\n# ~~~\n# bar baz'
	);
});

test('keeps code fences open past lines with text after a marker', () => {
	const input = '# ```\n# ``` foo\n# bar\n# baz';

	expect(formatComment(input)).toBe(input);
});

test('keeps code fences that open list items as written', () => {
	expect(
		formatComment('# - ```sh\n#   foo  bar\n#   ```\n# baz\n# qux')
	).toBe('# - ```sh\n#   foo  bar\n#   ```\n# baz qux');
	expect(
		formatComment('# - - ```sh\n#     foo  bar\n#     ```\n# baz\n# qux')
	).toBe('# - - ```sh\n#     foo  bar\n#     ```\n# baz qux');
});

test('ends code fences only at a closing marker without a list marker', () => {
	expect(
		formatComment('# ```md\n# - ```\n# foo  bar\n# ```\n# baz\n# qux')
	).toBe('# ```md\n# - ```\n# foo  bar\n# ```\n# baz qux');
});

test('treats lines that start with inline code as text', () => {
	expect(formatComment('# ```foo``` bar\n# baz')).toBe('# ```foo``` bar baz');
});

test('keeps words that would open a code fence with the word before them', () => {
	expect(formatComment('# foo bar baz ```qux', { printWidth: 13 })).toBe(
		'# foo bar baz ```qux'
	);
	expect(formatComment('# foo bar baz ~~~qux', { printWidth: 13 })).toBe(
		'# foo bar baz ~~~qux'
	);
});

test('keeps lines apart when joining is off', () => {
	const options = { joinLines: false, printWidth: 14 };

	const output = formatComment(
		'# foo\n# bar baz qux quux\n# - corge grault garply',
		options
	);

	expect(output).toBe(
		'# foo\n# bar baz qux\n# quux\n# - corge\n#   grault\n#   garply'
	);
	expect(formatComment(output, options)).toBe(output);
});

test('finds the lines of code fences', () => {
	expect(
		findFencedLines(['# foo', '# ```', '# bar', '# ```', '# baz'], '#')
	).toStrictEqual(new Set([1, 2, 3]));
});

test('fills text with a prefix and a continuation', () => {
	expect(
		fillCommentText('bar baz qux quux', '# foo ', '#     ', {
			indentation: '',
			joinLines: true,
			printWidth: 14,
			syntax: TEST_SYNTAX,
			tabWidth: 2,
		})
	).toStrictEqual(['# foo bar baz', '#     qux quux']);
});
