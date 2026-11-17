import { expect, test } from 'vite-plus/test';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	PRAGMA_PATTERN,
} from './index.ts';

test('matches directives', () => {
	expect('shellcheck disable=SC2086').toMatch(DIRECTIVE_PATTERN);
	expect('shellchecked').not.toMatch(DIRECTIVE_PATTERN);
});

test('matches `prettier-ignore` markers', () => {
	expect('#  prettier-ignore').toMatch(IGNORE_MARKER_PATTERN);
	expect('# prettier-ignore foo').not.toMatch(IGNORE_MARKER_PATTERN);
});

test('matches pragmas', () => {
	expect('@format').toMatch(PRAGMA_PATTERN);
	expect('foo @format').not.toMatch(PRAGMA_PATTERN);
});
