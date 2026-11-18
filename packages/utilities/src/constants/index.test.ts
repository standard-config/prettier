import { expect, test } from 'vite-plus/test';
import { SUPPRESSION_PATTERN } from './index.ts';

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
	expect('trufflehog:ignore').toMatch(SUPPRESSION_PATTERN);
	expect('tslint:disable-line').toMatch(SUPPRESSION_PATTERN);
	expect('bar -- gitleaks:allow').toMatch(SUPPRESSION_PATTERN);

	expect('barggignore').not.toMatch(SUPPRESSION_PATTERN);
	expect('gitleaks:allowed').not.toMatch(SUPPRESSION_PATTERN);
});
