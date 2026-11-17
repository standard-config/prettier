import type { ParserOptions } from 'prettier';
import { expect, test } from 'vite-plus/test';
import findCommentLines from './index.ts';

const BATS_VARIANT = 8;
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

	await expect(findCommentLines(input, OPTIONS)).resolves.toStrictEqual(
		new Set([0, 2, 4, 9, 14])
	);
});

test('excludes shebangs, trailing comments, heredocs, and strings', async () => {
	const input = [
		'#!/bin/sh',
		'foo # bar',
		'cat << EOF',
		'# baz',
		'EOF',
		"jq -r '",
		'  # qux',
		"  .quux' corge",
		'grault="garply',
		'# waldo"',
	];

	await expect(findCommentLines(input, OPTIONS)).resolves.toStrictEqual(
		new Set()
	);
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

	await expect(findCommentLines(input, OPTIONS)).resolves.toStrictEqual(
		new Set()
	);
});

test('ignores source text that resembles a mark', async () => {
	const input = ['# foo', 'bar=prettier_plugin_shell_comments_probe_0_'];

	await expect(findCommentLines(input, OPTIONS)).resolves.toStrictEqual(
		new Set([0])
	);
});

test('keeps marks distinct from digits after `#`', async () => {
	const input = ["foo='", "#2 bar'"];

	await expect(findCommentLines(input, OPTIONS)).resolves.toStrictEqual(
		new Set()
	);
});

test('respects `variant`', async () => {
	const input = ['@test "foo" {', '  # bar', '  run baz', '}'];
	const options = { variant: BATS_VARIANT } as unknown as ParserOptions;

	await expect(findCommentLines(input, options)).resolves.toStrictEqual(
		new Set([1])
	);
});

test('finds no comments when marking them breaks the code', async () => {
	const input = ['# foo', "cat << '#EOF'", 'bar', '#EOF'];

	await expect(findCommentLines(input, OPTIONS)).resolves.toStrictEqual(
		new Set()
	);
});
