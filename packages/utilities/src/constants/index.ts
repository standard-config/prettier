// These directives cover the line below them
export const NEXT_LINE_DIRECTIVE_PATTERN =
	/^(?:\$Flow(?:ExpectedError|FixMe|Ignore|Issue)\b|(?:biome-ignore|deno-lint-ignore|(?:eslint|oxlint)-disable-next-line|nosemgrep|tslint:disable-next-line)\b|(?:c8|istanbul|v8)[ \t]+ignore\b|(?:cSpell|cspell|spell-?checker):[ \t]*disable-next-line\b|node:coverage\b|pragma: ?allowlist[ -]nextline[ -]secret\b|prettier-ignore$)/;

// Moving these suppression markers can change which code tools ignore
export const SUPPRESSION_PATTERN =
	/\b(?:codespell:ignore|cspell:disable-line|ggignore|gitleaks:allow|jshint ignore:line|nosemgrep|NOSONAR|pragma: ?(?:allow|white)list[ -](?:nextline[ -])?secret|trufflehog:ignore|tslint:disable-line)\b/;
