import {
	SEMGREP_MARKER_PATTERN,
	SEMGREP_PREVIOUS_LINE_PATTERN,
} from '../constants/index.ts';

// Codespell needs punctuation before its directive and reads words on that line
const CODESPELL_LINE_PATTERN =
	/[^\p{L}\p{N}_\s]\s*codespell:ignore(?![-\p{L}\p{N}_])/u;
const CODESPELL_NEXT_LINE_PATTERN =
	/[^\p{L}\p{N}_\s]\s*codespell:ignore-next-line(?![\p{L}\p{N}_])/u;

const CSPELL_LINE_PATTERN = /\bc?spell(?:-?checker)?::?\s*disable-line\b/i;
const CSPELL_NEXT_LINE_PATTERN = /\bc?spell(?:-?checker)?::?\s*disable-next\b/i;

// detect-secrets needs the real comment delimiters on the physical line
const DETECT_SECRETS_LINE_PATTERN =
	/(?:[#']|\/\/|--) *pragma: ?(?:allow|white)list[ -]secret|\/\* *pragma: ?(?:allow|white)list[ -]secret.*?\*\/[ \t]*$|<!--[# \t]*? *pragma: ?(?:allow|white)list[ -]secret.*?-->[ \t]*$/;
const DETECT_SECRETS_NEXT_LINE_PATTERN =
	/^[ \t]*(?:(?:[#']|\/\/|--) *pragma: ?allowlist[ -]nextline[ -]secret|\/\* *pragma: ?allowlist[ -]nextline[ -]secret.*?\*\/[ \t]*$|<!--[# \t]*? *pragma: ?allowlist[ -]nextline[ -]secret.*?-->[ \t]*$)/;

const GITGUARDIAN_LINE_PATTERN = /(?:#|\/\/)[ \t]*ggignore\b/;

/**
 * Checks for suppressions that must keep their source line intact.
 */
export function hasPhysicalLineSuppression(line: string): boolean {
	return (
		CODESPELL_LINE_PATTERN.test(line) ||
		CSPELL_LINE_PATTERN.test(line) ||
		DETECT_SECRETS_LINE_PATTERN.test(line) ||
		GITGUARDIAN_LINE_PATTERN.test(line) ||
		line.includes('trufflehog:ignore') ||
		SEMGREP_MARKER_PATTERN.test(line) ||
		hasPhysicalNextLineSuppression(line)
	);
}

/**
 * Checks the physical line for a suppression that covers the following line.
 */
export function hasPhysicalNextLineSuppression(line: string): boolean {
	return (
		CODESPELL_NEXT_LINE_PATTERN.test(line) ||
		CSPELL_NEXT_LINE_PATTERN.test(line) ||
		DETECT_SECRETS_NEXT_LINE_PATTERN.test(line) ||
		SEMGREP_PREVIOUS_LINE_PATTERN.test(line)
	);
}
