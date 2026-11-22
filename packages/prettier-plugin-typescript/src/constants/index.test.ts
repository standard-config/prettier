import { expect, test } from 'vite-plus/test';
import {
	BLOCK_DIRECTIVE_PATTERN,
	CONFIGURATION_COMMENT_PATTERN,
	CONTINUED_DIRECTIVE_PATTERN,
	FALL_THROUGH_PATTERN,
	INDENTED_LINE_PATTERN,
	LINE_DIRECTIVE_PATTERN,
	LIST_DIRECTIVE_PATTERN,
	TYPESCRIPT_DIRECTIVE_PATTERN,
	UNFINISHED_SETTING_PATTERN,
} from './index.ts';

test('matches directives that tools read from block comments', () => {
	expect('@jsx h').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@jsxImportSource preact').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@ts-expect-error -- foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('@ts-ignore').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('biome-ignore lint: foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('c8 ignore next 3').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('cSpell:disable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint "quotes": [2, "single"]').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect("eslint 'quotes': 2").toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint @typescript-eslint/no-explicit-any: off').toMatch(
		BLOCK_DIRECTIVE_PATTERN
	);
	expect('eslint no-console: off').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable-next-line no-console').toMatch(
		BLOCK_DIRECTIVE_PATTERN
	);
	expect('eslint-enable no-console').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-env node').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('exported foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('global foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('globals foo, bar').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('istanbul ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('node:coverage ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('oxlint-disable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('oxlint-disable-next-line').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('oxlint-enable').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('prettier-ignore').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('spell-checker:ignore foo').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('v8 ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('v8  ignore next').toMatch(BLOCK_DIRECTIVE_PATTERN);

	expect('@jsxFoo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint complains about this').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint no-console:').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disable-foo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-disabled').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslint-enable-line').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('eslintrc').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('foo @ts-ignore').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('globalThis.foo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
	expect('prettier-ignore foo').not.toMatch(BLOCK_DIRECTIVE_PATTERN);
});

test('matches configuration comments', () => {
	expect('eslint').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('eslint no-console: off').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('eslint-env node').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('exported foo').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('global foo').toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('globals foo').toMatch(CONFIGURATION_COMMENT_PATTERN);

	expect('eslint-disable foo').not.toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('eslintrc').not.toMatch(CONFIGURATION_COMMENT_PATTERN);
	expect('globalThis').not.toMatch(CONFIGURATION_COMMENT_PATTERN);
});

test('matches directive lines that continue on the next line', () => {
	expect('global foo,').toMatch(CONTINUED_DIRECTIVE_PATTERN);
	expect('eslint quotes:').toMatch(CONTINUED_DIRECTIVE_PATTERN);

	expect('global foo').not.toMatch(CONTINUED_DIRECTIVE_PATTERN);
});

test('matches fall-through comments', () => {
	expect('falls through').toMatch(FALL_THROUGH_PATTERN);
	expect('Intentional fallthrough').toMatch(FALL_THROUGH_PATTERN);
	expect('falling through').not.toMatch(FALL_THROUGH_PATTERN);
});

test('matches indented line comments', () => {
	expect('//  foo').toMatch(INDENTED_LINE_PATTERN);
	expect('//\tfoo').toMatch(INDENTED_LINE_PATTERN);
	expect('///   foo').toMatch(INDENTED_LINE_PATTERN);

	expect('// foo').not.toMatch(INDENTED_LINE_PATTERN);
	expect('//   ').not.toMatch(INDENTED_LINE_PATTERN);
});

test('matches directives that tools only read from line comments', () => {
	expect('#region Validation').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('# sourceMappingURL=index.js.map').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('#\tsourceURL=index.js').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('# debugId=85314830-023f-4cf1-a267-535f4e37bb17').toMatch(
		LINE_DIRECTIVE_PATTERN
	);
	expect('@sourceMappingURL = index.js.map').toMatch(LINE_DIRECTIVE_PATTERN);
	expect('endregion').toMatch(LINE_DIRECTIVE_PATTERN);

	expect('Region').not.toMatch(LINE_DIRECTIVE_PATTERN);
	expect('regional').not.toMatch(LINE_DIRECTIVE_PATTERN);
});

test('matches directives that take lists', () => {
	expect('eslint no-console: off').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-disable foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-enable foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-env node').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('exported foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('global foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('globals foo').toMatch(LIST_DIRECTIVE_PATTERN);
	expect('oxlint-disable foo').toMatch(LIST_DIRECTIVE_PATTERN);

	expect('@ts-expect-error foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('biome-ignore lint: foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-disable-line foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('eslint-disable-next-line foo').not.toMatch(LIST_DIRECTIVE_PATTERN);
	expect('globalThis').not.toMatch(LIST_DIRECTIVE_PATTERN);
});

test('matches directives that TypeScript only reads from line comments', () => {
	expect('<reference types="vite/client" />').toMatch(
		TYPESCRIPT_DIRECTIVE_PATTERN
	);
	expect('<REFERENCE types="vite/client" />').toMatch(
		TYPESCRIPT_DIRECTIVE_PATTERN
	);
	expect('@ts-check').toMatch(TYPESCRIPT_DIRECTIVE_PATTERN);
	expect('@TS-NOCHECK').toMatch(TYPESCRIPT_DIRECTIVE_PATTERN);

	expect('@ts-checked').not.toMatch(TYPESCRIPT_DIRECTIVE_PATTERN);
});

test('matches unfinished rule settings', () => {
	expect('eslint').toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint "quotes"').toMatch(UNFINISHED_SETTING_PATTERN);
	expect("eslint 'quotes':").toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint no-console').toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint no-console:').toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint "no-').toMatch(UNFINISHED_SETTING_PATTERN);
	expect("eslint 'no-").toMatch(UNFINISHED_SETTING_PATTERN);

	expect('eslint complains about this').not.toMatch(
		UNFINISHED_SETTING_PATTERN
	);
	expect('eslint "no-console" off').not.toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint no-console: off').not.toMatch(UNFINISHED_SETTING_PATTERN);
	expect('eslint-disable').not.toMatch(UNFINISHED_SETTING_PATTERN);
});
