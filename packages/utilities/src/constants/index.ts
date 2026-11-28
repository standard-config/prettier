export const GITLEAKS_ALLOW_MARKER = 'gitleaks:allow';

// These directives cover the line below them
export const NEXT_LINE_DIRECTIVE_PATTERN =
	/^(?:\$Flow(?:ExpectedError|FixMe|Ignore|Issue)\b|(?:biome-ignore|deno-lint-ignore|(?:eslint|oxlint)-disable-next-line|tslint:disable-next-line)\b|(?:c8|istanbul|v8)[ \t]+ignore\b|node:coverage\b|prettier-ignore$)/;

// Semgrep accepts a `nosem` prefix after a literal space on the finding’s line
// or after punctuation alone on the previous line
export const SEMGREP_MARKER_PATTERN = /(?:^[^a-z0-9]*| )nosem/i;

export const SEMGREP_PREVIOUS_LINE_PATTERN = /^[^a-z0-9]*nosem/i;

// Moving these suppression markers can change which code tools ignore
export const SUPPRESSION_PATTERN =
	/\b(?:gitleaks:allow|jshint ignore:line|NOSONAR|tslint:disable-line)\b/;
