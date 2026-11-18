import { expect, test } from 'vite-plus/test';
import { NEXT_LINE_DIRECTIVE_PATTERN, SUPPRESSION_PATTERN } from './index.ts';

test('matches directives that cover the line below them', () => {
	expect('$FlowFixMe[prop-missing]').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('cspell:disable-next-line').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('eslint-disable-next-line no-console').toMatch(
		NEXT_LINE_DIRECTIVE_PATTERN
	);
	expect('nosemgrep: foo').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('pragma: allowlist nextline secret').toMatch(
		NEXT_LINE_DIRECTIVE_PATTERN
	);
	expect('pragma:allowlist-nextline-secret').toMatch(
		NEXT_LINE_DIRECTIVE_PATTERN
	);
	expect('prettier-ignore').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('v8  ignore next').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);

	expect('cspell:disable-line').not.toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('pragma: allowlist secret').not.toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('prettier-ignore foo').not.toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
});

test('matches suppression markers', () => {
	expect('codespell:ignore').toMatch(SUPPRESSION_PATTERN);
	expect('cspell:disable-line').toMatch(SUPPRESSION_PATTERN);
	expect('ggignore').toMatch(SUPPRESSION_PATTERN);
	expect('gitleaks:allow').toMatch(SUPPRESSION_PATTERN);
	expect('jshint ignore:line').toMatch(SUPPRESSION_PATTERN);
	expect('nosemgrep: foo').toMatch(SUPPRESSION_PATTERN);
	expect('NOSONAR').toMatch(SUPPRESSION_PATTERN);
	expect('pragma: allowlist nextline secret').toMatch(SUPPRESSION_PATTERN);
	expect('pragma: allowlist secret').toMatch(SUPPRESSION_PATTERN);
	expect('pragma: whitelist secret').toMatch(SUPPRESSION_PATTERN);
	expect('pragma:allowlist-secret').toMatch(SUPPRESSION_PATTERN);
	expect('trufflehog:ignore').toMatch(SUPPRESSION_PATTERN);
	expect('tslint:disable-line').toMatch(SUPPRESSION_PATTERN);
	expect('bar -- gitleaks:allow').toMatch(SUPPRESSION_PATTERN);

	expect('barggignore').not.toMatch(SUPPRESSION_PATTERN);
	expect('gitleaks:allowed').not.toMatch(SUPPRESSION_PATTERN);
});
