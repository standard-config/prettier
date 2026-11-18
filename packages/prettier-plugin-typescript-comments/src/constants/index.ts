import type { CommentSyntax } from '@standard-config/utilities/types';

// Tools that read these directives from `//` comments read them from block
// comments too
export const BLOCK_DIRECTIVE_PATTERN =
	/^(?:@jsx(?:Frag|ImportSource|Runtime)?\b|@ts-(?:expect-error|ignore)\b|(?:biome-ignore|eslint-disable-(?:next-)?line|oxlint-disable-(?:next-)?line)\b|(?:c8|istanbul|v8) ignore\b|(?:cSpell|cspell|spell-?checker):|node:coverage\b|prettier-ignore$)/;

export const COMMENT_SYNTAX: CommentSyntax = {
	marker: '//',
	// Bundlers keep `//!` comments and those that mention `@license` or
	// `@preserve` as legal comments
	isBlockKept: (line) =>
		line.startsWith('//!') || /@(?:license|preserve)\b/.test(line),
	isDirective: (text) =>
		BLOCK_DIRECTIVE_PATTERN.test(text) ||
		LINE_DIRECTIVE_PATTERN.test(text) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(text) ||
		RANGE_DIRECTIVE_PATTERN.test(text) ||
		TYPESCRIPT_DIRECTIVE_PATTERN.test(text),
	isLineKept: () => false,
	isUnsafeLineStart: (word) =>
		BLOCK_DIRECTIVE_PATTERN.test(word) ||
		LINE_DIRECTIVE_PATTERN.test(word) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(word) ||
		RANGE_DIRECTIVE_PATTERN.test(word) ||
		TYPESCRIPT_DIRECTIVE_PATTERN.test(word) ||
		/^(?:[#@]|c8|istanbul|v8)$/.test(word),
};

export const FALL_THROUGH_PATTERN = /falls?\s?through/i;

// Tools only read these directives from `//` comments
export const LINE_DIRECTIVE_PATTERN =
	/^(?:#?(?:end)?region\b|[#@][ \t]*(?:debugId|source(?:Mapping)?URL)[ \t]*=)/;

// These directives cover the line below them, along with fall-through
// comments and TypeScript suppressions
export const NEXT_LINE_DIRECTIVE_PATTERN =
	/^(?:\$Flow(?:ExpectedError|FixMe|Ignore|Issue)\b|(?:biome-ignore|deno-lint-ignore|(?:eslint|oxlint)-disable-next-line|nosemgrep|tslint:disable-next-line)\b|(?:c8|istanbul|v8) ignore\b|(?:cSpell|cspell|spell-?checker):[ \t]*disable-next-line\b|node:coverage\b|pragma: allowlist nextline secret\b|prettier-ignore$)/;

// ESLint ignores `eslint-disable` and `eslint-enable` in `//` comments, so
// converting them to block comments would activate them. Keep the
// corresponding `oxlint-` forms as written too
export const RANGE_DIRECTIVE_PATTERN =
	/^(?:eslint|oxlint)-(?:disable|enable)\b(?!-)/;

// TypeScript only reads these directives from `//` comments, ignoring case in
// their names
export const TYPESCRIPT_DIRECTIVE_PATTERN =
	/^(?:<(?:amd-dependency|amd-module|reference)\b|@ts-(?:check|nocheck)\b)/i;

export const TYPESCRIPT_SUPPRESSION_PATTERN = /^@ts-(?:expect-error|ignore)\b/;
