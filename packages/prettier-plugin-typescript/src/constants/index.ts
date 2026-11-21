import type { CommentSyntax } from '@standard-config/utilities/types';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';

// Tools read these directives from block comments. Convert line comments with
// `eslint-disable`, `eslint-enable`, or configuration directives such as
// `global` to the block form ESLint reads. Treat `eslint-env` like the other
// configuration directives, even though flat config ignores it or reports it as
// unsupported. Only convert `eslint` before a rule setting so ESLint won’t
// parse prose as configuration
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
	// Keep next-line directives directly above the lines they cover. Leave any
	// comment on those lines as written
	isLineKept: (texts, index) =>
		NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index]!) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index - 1] ?? ''),
	isUnsafeLineStart: (word) =>
		BLOCK_DIRECTIVE_PATTERN.test(word) ||
		LINE_DIRECTIVE_PATTERN.test(word) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(word) ||
		TYPESCRIPT_DIRECTIVE_PATTERN.test(word) ||
		/^(?:(?:[#@]|c8|eslint|istanbul|v8)$|pragma:)/.test(word),
	// Keep a paragraph’s opening line as written if it contains an unfinished
	// setting or a configuration comment after more than two slashes. Reflow
	// could strip the extra slashes or complete the setting with the next line.
	// Either change could turn it into a block comment on a later run
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

// A `//` line with text indented past one space after the slashes can continue
// the directive’s list from the line above
export const INDENTED_LINE_PATTERN = /^\/{2,}(?:\t|[ \t]{2})[ \t]*\S/;

// Tools only read these directives from `//` comments
export const LINE_DIRECTIVE_PATTERN =
	/^(?:#?(?:end)?region\b|[#@][ \t]*(?:debugId|source(?:Mapping)?URL)[ \t]*=)/;

// These directives take lists of rules or names that can continue on the next
// `//` line. This excludes their `-line` and `-next-line` forms because the
// linters read those lists from a single `//` line
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
