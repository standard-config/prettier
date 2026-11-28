import { expect, test } from 'vite-plus/test';
import {
	NEXT_LINE_DIRECTIVE_PATTERN,
	SEMGREP_MARKER_PATTERN,
	SEMGREP_PREVIOUS_LINE_PATTERN,
	SUPPRESSION_PATTERN,
} from './index.ts';

test('matches directives that cover the line below them', () => {
	expect('$FlowFixMe[prop-missing]').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('eslint-disable-next-line no-console').toMatch(
		NEXT_LINE_DIRECTIVE_PATTERN
	);
	expect('prettier-ignore').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
	expect('v8  ignore next').toMatch(NEXT_LINE_DIRECTIVE_PATTERN);

	expect('prettier-ignore foo').not.toMatch(NEXT_LINE_DIRECTIVE_PATTERN);
});

test('matches suppression markers', () => {
	expect('gitleaks:allow').toMatch(SUPPRESSION_PATTERN);
	expect('jshint ignore:line').toMatch(SUPPRESSION_PATTERN);
	expect('NOSONAR').toMatch(SUPPRESSION_PATTERN);
	expect('tslint:disable-line').toMatch(SUPPRESSION_PATTERN);
	expect('bar -- gitleaks:allow').toMatch(SUPPRESSION_PATTERN);

	expect('gitleaks:allowed').not.toMatch(SUPPRESSION_PATTERN);
});

test('distinguishes Semgrep markers on the finding line and the preceding line', () => {
	expect('// NoSeM: foo').toMatch(SEMGREP_PREVIOUS_LINE_PATTERN);
	expect('# NOSEMGREP: foo').toMatch(SEMGREP_PREVIOUS_LINE_PATTERN);
	expect('foo(); // nosem').not.toMatch(SEMGREP_PREVIOUS_LINE_PATTERN);
	expect('foo(); // nosem').toMatch(SEMGREP_MARKER_PATTERN);
	expect('// foo\tNoSeM: foo').not.toMatch(SEMGREP_MARKER_PATTERN);
});
