// Tools read these directives from block comments. Convert line comments with
// `eslint-disable`, `eslint-enable`, or configuration directives such as
// `global` to the block form ESLint reads. Treat `eslint-env` like the other
// configuration directives, even though flat config ignores it or reports it as
// unsupported. Only convert `eslint` before a rule setting so ESLint won’t
// parse prose as configuration
export const BLOCK_DIRECTIVE_PATTERN =
	/^(?:@jsx(?:Frag|ImportSource|Runtime)?\b|@ts-(?:expect-error|ignore)\b|(?:biome-ignore|eslint-disable-(?:next-)?line|oxlint-disable-(?:next-)?line)\b|(?:c8|istanbul|v8)[ \t]+ignore\b|(?:cSpell|cspell|spell-?checker):|eslint[ \t]+(?:"[^"]*"|'[^']*'|[\w@/-]+)[ \t]*:(?=[ \t]*\S)|(?:eslint|oxlint)-(?:disable|enable)\b(?!-)|(?:eslint-env|exported|globals?)(?=[ \t]|$)|node:coverage\b|prettier-ignore$)/;

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
