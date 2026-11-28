import { expect, test } from 'vite-plus/test';
import {
	hasPhysicalLineSuppression,
	hasPhysicalNextLineSuppression,
} from './index.ts';

test('recognizes the lines covered by Semgrep suppressions', () => {
	const previous = '// nosemgrep: foo';
	const inline = '// foo nosemgrep';

	expect(hasPhysicalLineSuppression(previous)).toBe(true);
	expect(hasPhysicalNextLineSuppression(previous)).toBe(true);
	expect(hasPhysicalLineSuppression(inline)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inline)).toBe(false);
});

test('recognizes the lines covered by codespell suppressions', () => {
	const nextWithWords = '# codespell:ignore-next-line wrod,fooo';
	const next = '// codespell:ignore-next-line';
	const inlineWithWord = '* wrod // codespell:ignore wrod';
	const inline = '// codespell:ignore';
	const proseWithWord = '* wrod codespell:ignore wrod';
	const proseWithNext = '* wrod codespell:ignore-next-line wrod';
	const unknownDirective = '* codespell:ignore-unrelated';

	expect(hasPhysicalLineSuppression(nextWithWords)).toBe(true);
	expect(hasPhysicalNextLineSuppression(nextWithWords)).toBe(true);
	expect(hasPhysicalLineSuppression(next)).toBe(true);
	expect(hasPhysicalNextLineSuppression(next)).toBe(true);
	expect(hasPhysicalLineSuppression(inlineWithWord)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inlineWithWord)).toBe(false);
	expect(hasPhysicalLineSuppression(inline)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inline)).toBe(false);
	expect(hasPhysicalLineSuppression(proseWithWord)).toBe(false);
	expect(hasPhysicalNextLineSuppression(proseWithWord)).toBe(false);
	expect(hasPhysicalLineSuppression(proseWithNext)).toBe(false);
	expect(hasPhysicalNextLineSuppression(proseWithNext)).toBe(false);
	expect(hasPhysicalLineSuppression(unknownDirective)).toBe(false);
	expect(hasPhysicalNextLineSuppression(unknownDirective)).toBe(false);
});

test('recognizes the lines covered by cspell suppressions', () => {
	const nextAlias = '* SpElL-ChEcKeR: disable-next';
	const next = '/* cspell:disable-next-line */';
	const inline = '* fooo spellchecker:disable-line';

	expect(hasPhysicalLineSuppression(nextAlias)).toBe(true);
	expect(hasPhysicalNextLineSuppression(nextAlias)).toBe(true);
	expect(hasPhysicalLineSuppression(next)).toBe(true);
	expect(hasPhysicalNextLineSuppression(next)).toBe(true);
	expect(hasPhysicalLineSuppression(inline)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inline)).toBe(false);
});

test('recognizes the lines covered by detect-secrets suppressions', () => {
	const nextBlock = '/* pragma: allowlist nextline secret */';
	const nextHash = '# pragma:allowlist-nextline-secret';
	const nextHTML = '<!-- pragma: allowlist nextline secret -->';
	const inlineSlash = '* foo // pragma: allowlist secret';
	const inlineBlock = 'foo /* pragma: whitelist secret */';
	const inlineHTML = 'foo <!-- pragma: allowlist secret -->';
	const prose = '* foo pragma: allowlist secret';
	const missingOpener = '* pragma: allowlist nextline secret */';
	const missingCloser = '/* pragma: allowlist nextline secret';
	const afterCode = 'foo(); /* pragma: allowlist nextline secret */';
	const trailing = 'foo # pragma: allowlist nextline secret';

	expect(hasPhysicalLineSuppression(nextBlock)).toBe(true);
	expect(hasPhysicalNextLineSuppression(nextBlock)).toBe(true);
	expect(hasPhysicalLineSuppression(nextHash)).toBe(true);
	expect(hasPhysicalNextLineSuppression(nextHash)).toBe(true);
	expect(hasPhysicalLineSuppression(nextHTML)).toBe(true);
	expect(hasPhysicalNextLineSuppression(nextHTML)).toBe(true);
	expect(hasPhysicalLineSuppression(inlineSlash)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inlineSlash)).toBe(false);
	expect(hasPhysicalLineSuppression(inlineBlock)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inlineBlock)).toBe(false);
	expect(hasPhysicalLineSuppression(inlineHTML)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inlineHTML)).toBe(false);
	expect(hasPhysicalLineSuppression(prose)).toBe(false);
	expect(hasPhysicalNextLineSuppression(prose)).toBe(false);
	expect(hasPhysicalLineSuppression(missingOpener)).toBe(false);
	expect(hasPhysicalNextLineSuppression(missingOpener)).toBe(false);
	expect(hasPhysicalLineSuppression(missingCloser)).toBe(false);
	expect(hasPhysicalNextLineSuppression(missingCloser)).toBe(false);
	expect(hasPhysicalLineSuppression(afterCode)).toBe(false);
	expect(hasPhysicalNextLineSuppression(afterCode)).toBe(false);
	expect(hasPhysicalLineSuppression(trailing)).toBe(false);
	expect(hasPhysicalNextLineSuppression(trailing)).toBe(false);
});

test('recognizes the lines covered by GitGuardian suppressions', () => {
	const slash = '* foo // ggignore';
	const hash = '* foo # ggignore';
	const prose = '* foo ggignore';

	expect(hasPhysicalLineSuppression(slash)).toBe(true);
	expect(hasPhysicalNextLineSuppression(slash)).toBe(false);
	expect(hasPhysicalLineSuppression(hash)).toBe(true);
	expect(hasPhysicalNextLineSuppression(hash)).toBe(false);
	expect(hasPhysicalLineSuppression(prose)).toBe(false);
	expect(hasPhysicalNextLineSuppression(prose)).toBe(false);
});

test('recognizes the lines covered by TruffleHog suppressions', () => {
	const inline = '* foo trufflehog:ignore';

	expect(hasPhysicalLineSuppression(inline)).toBe(true);
	expect(hasPhysicalNextLineSuppression(inline)).toBe(false);
});
