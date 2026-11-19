import type { CommentSyntax } from '@standard-config/utilities/types';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';

// Tools read these directives from block comments. ESLint ignores
// `eslint-disable`, `eslint-enable`, and its configuration comments, such as
// `global`, in `//` comments, so converting those gives them the form their
// authors presumably intended. That includes `eslint-env` for consistency,
// although flat config ignores it or reports it as unsupported. `eslint`
// converts only before a rule setting, since other text would become a
// configuration ESLint can’t parse
export const BLOCK_DIRECTIVE_PATTERN =
	/^(?:@jsx(?:Frag|ImportSource|Runtime)?\b|@ts-(?:expect-error|ignore)\b|(?:biome-ignore|eslint-disable-(?:next-)?line|oxlint-disable-(?:next-)?line)\b|(?:c8|istanbul|v8)[ \t]+ignore\b|(?:cSpell|cspell|spell-?checker):|eslint[ \t]+(?:"[^"]*"|'[^']*'|[\w@/-]+)[ \t]*:(?=[ \t]*\S)|(?:eslint|oxlint)-(?:disable|enable)\b(?!-)|(?:eslint-env|exported|globals?)(?=[ \t]|$)|node:coverage\b|prettier-ignore$)/;

export const COMMENT_SYNTAX: CommentSyntax = {
	marker: '//',
	// Bundlers keep `//!` comments and those that mention `@license` or
	// `@preserve` as legal comments
	isBlockKept: (line) =>
		line.startsWith('//!') || /@(?:license|preserve)\b/.test(line),
	// ESLint ignores its configuration comments in `//` comments, so a line
	// starting with `global` can join the prose above
	isDirective: (text) =>
		(BLOCK_DIRECTIVE_PATTERN.test(text) &&
			!CONFIGURATION_COMMENT_PATTERN.test(text)) ||
		LINE_DIRECTIVE_PATTERN.test(text) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(text) ||
		TYPESCRIPT_DIRECTIVE_PATTERN.test(text),
	// A directive that covers the next line stays right above that line, and
	// a comment there stays as written
	isLineKept: (texts, index) =>
		NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index]!) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index - 1] ?? ''),
	isUnsafeLineStart: (word) =>
		BLOCK_DIRECTIVE_PATTERN.test(word) ||
		LINE_DIRECTIVE_PATTERN.test(word) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(word) ||
		TYPESCRIPT_DIRECTIVE_PATTERN.test(word) ||
		/^(?:(?:[#@]|c8|eslint|istanbul|v8)$|pragma:)/.test(word),
	// A line with a configuration comment after more than two slashes, as in
	// `///`, or an unfinished setting stays as written when it would start a
	// paragraph. Reflow could remove the extra slashes or complete the setting
	// with the next line, allowing a later run to convert the line to a block
	// comment
	isUnsafeParagraphStart: (line) => {
		const text = line.replace(/^\/+[ \t]*/, '');

		return (
			(line.startsWith('///') &&
				BLOCK_DIRECTIVE_PATTERN.test(text) &&
				CONFIGURATION_COMMENT_PATTERN.test(text)) ||
			UNFINISHED_SETTING_PATTERN.test(text)
		);
	},
};

// ESLint’s configuration comments start with these names
export const CONFIGURATION_COMMENT_PATTERN =
	/^(?:eslint(?:-env)?|exported|globals?)(?=[ \t]|$)/;

// A trailing comma or colon can continue a directive’s list in a `//` comment
// on the next line
export const CONTINUED_DIRECTIVE_PATTERN = /[,:][ \t]*$/;

export const FALL_THROUGH_PATTERN = /falls?\s?through/i;

// A `//` line with text indented past one space after the slashes can
// continue the directive’s list from the line above
export const INDENTED_LINE_PATTERN = /^\/{2,}(?:\t|[ \t]{2})[ \t]*\S/;

// Tools only read these directives from `//` comments
export const LINE_DIRECTIVE_PATTERN =
	/^(?:#?(?:end)?region\b|[#@][ \t]*(?:debugId|source(?:Mapping)?URL)[ \t]*=)/;

// These directives take lists of rules or names that can continue on the next
// `//` line. Their `-line` and `-next-line` forms are left out, since the
// respective linters read those from a `//` comment, whose list ends with its
// line
export const LIST_DIRECTIVE_PATTERN =
	/^(?:(?:eslint|oxlint)-(?:disable|enable)|eslint(?:-env)?|exported|globals?)(?=[ \t]|$)/;

// TypeScript only reads these directives from `//` comments, ignoring case in
// their names
export const TYPESCRIPT_DIRECTIVE_PATTERN =
	/^(?:<(?:amd-dependency|amd-module|reference)\b|@ts-(?:check|nocheck)\b)/i;

export const TYPESCRIPT_SUPPRESSION_PATTERN = /^@ts-(?:expect-error|ignore)\b/;

// An `eslint` comment with at most a rule name and colon, or with a quoted rule
// name it doesn’t close, doesn’t finish its rule setting
export const UNFINISHED_SETTING_PATTERN =
	/^eslint(?:[ \t]+(?:"[^"]*"?|'[^']*'?|[\w@/-]+)(?:[ \t]*:)?)?[ \t]*$/;
