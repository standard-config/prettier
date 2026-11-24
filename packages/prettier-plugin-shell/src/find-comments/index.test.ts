import type { ParserOptions } from 'prettier';
import { expect, test } from 'vite-plus/test';
import { BATS_VARIANT } from '../constants/index.ts';
import findComments from './index.ts';

const OPTIONS = {} as unknown as ParserOptions;

test('finds comments on lines of their own', async () => {
	const input = [
		'# foo',
		'bar() {',
		'  # baz',
		'  case "$1" in',
		'    # qux',
		'    quux) : ;;',
		'  esac',
		'}',
		'corge="$(',
		'  # grault',
		'  garply',
		')"',
		'waldo \\',
		'  |',
		'  # fred',
		'  plugh',
	];

	await expect(findComments(input, OPTIONS)).resolves.toStrictEqual({
		fullLine: new Set([0, 2, 4, 9, 14]),
		trailing: new Map(),
	});
});

test('finds comments that follow code', async () => {
	const input = [
		'foo # bar',
		'baz "qux #quux" # corge',
		/* oxlint-disable-next-line eslint/no-template-curly-in-string */
		'grault ${#garply} $# # waldo',
		'fred # plugh # xyzzy',
	];

	await expect(findComments(input, OPTIONS)).resolves.toStrictEqual({
		fullLine: new Set(),
		trailing: new Map([
			[0, 4],
			[1, 16],
			[2, 21],
			[3, 5],
		]),
	});
});

test('excludes shebangs, heredocs, and strings', async () => {
	const input = [
		'#!/bin/sh',
		'cat << EOF',
		'# foo',
		'bar # baz',
		'EOF',
		"jq -r '",
		'  # qux',
		"  .quux' corge",
		'grault="garply',
		'# waldo"',
	];

	await expect(findComments(input, OPTIONS)).resolves.toStrictEqual({
		fullLine: new Set(),
		trailing: new Map(),
	});
});

test('excludes string lines before trailing comments and continued heredoc lines', async () => {
	const input = [
		"foo='",
		"# bar' # baz",
		'cat << EOF',
		'# qux \\',
		'EOF',
		'# quux',
		'EOF',
	];

	await expect(findComments(input, OPTIONS)).resolves.toStrictEqual({
		fullLine: new Set(),
		trailing: new Map([[1, 7]]),
	});
});

test('ignores source text that resembles a mark', async () => {
	const input = ['# foo', 'bar=prettier_plugin_shell_mark_0_'];

	await expect(findComments(input, OPTIONS)).resolves.toStrictEqual({
		fullLine: new Set([0]),
		trailing: new Map(),
	});
});

test('keeps marks distinct from digits after `#`', async () => {
	const input = ["foo='", "#2 bar'"];

	await expect(findComments(input, OPTIONS)).resolves.toStrictEqual({
		fullLine: new Set(),
		trailing: new Map(),
	});
});

test('respects `variant`', async () => {
	const input = ['@test "foo" {', '  # bar', '  run baz', '}'];
	const options = { variant: BATS_VARIANT } as unknown as ParserOptions;

	await expect(findComments(input, options)).resolves.toStrictEqual({
		fullLine: new Set([1]),
		trailing: new Map(),
	});
});

test('finds no comments when marking them breaks the code', async () => {
	const input = ['# foo', 'bar() {', "  cat << '#EOF'", 'baz', '#EOF', '}'];

	await expect(findComments(input, OPTIONS)).resolves.toStrictEqual({
		fullLine: new Set(),
		trailing: new Map(),
	});
});
