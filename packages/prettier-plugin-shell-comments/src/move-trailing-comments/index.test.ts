import type { ParserOptions } from 'prettier';
import { format } from 'prettier';
import * as pluginShell from 'prettier-plugin-sh';
import { expect, test } from 'vite-plus/test';
import moveTrailingComments from './index.ts';

const OPTIONS = { tabWidth: 2, useTabs: false } as unknown as ParserOptions;

async function reprint(text: string): Promise<string> {
	const output = await format(text, { parser: 'sh', plugins: [pluginShell] });
	return output;
}

async function reprintUnchanged(text: string): Promise<string> {
	await Promise.resolve();
	return text;
}

test('moves trailing comments above their lines', async () => {
	const input = 'foo() {\n  bar # baz\n  qux # quux\n}\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'foo() {\n  # baz\n  bar\n  # quux\n  qux\n}\n'
	);
});

test('moves comments on continued commands above their first line', async () => {
	const input = 'foo \\\n  | bar # baz\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'# baz\nfoo \\\n  | bar\n'
	);
});

test('moves comments on closing lines into the block body', async () => {
	const input =
		'for foo in "$@"; do\n  bar\ndone # baz\nif qux; then\n  quux\nfi # corge\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'for foo in "$@"; do\n  bar\n  # baz\ndone\nif qux; then\n  quux\n  # corge\nfi\n'
	);
});

test('indents comments on closing lines one level deeper than the line', async () => {
	const input = 'if foo; then\n  cat << EOF\nbar\nEOF\nfi # baz\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'if foo; then\n  cat << EOF\nbar\nEOF\n  # baz\nfi\n'
	);
});

test('respects `useTabs`', async () => {
	const input = 'if foo; then\n\tcat << EOF\nbar\nEOF\nfi # baz\n';
	const options = { tabWidth: 2, useTabs: true } as unknown as ParserOptions;

	await expect(
		moveTrailingComments(input, options, reprintUnchanged)
	).resolves.toBe('if foo; then\n\tcat << EOF\nbar\nEOF\n\t# baz\nfi\n');
});

test('moves comments above assignments that resemble closing lines', async () => {
	const input = 'done=false # foo\nfi-bar # baz\n}qux # quux\n';

	await expect(
		moveTrailingComments(input, OPTIONS, reprintUnchanged)
	).resolves.toBe('# foo\ndone=false\n# baz\nfi-bar\n# quux\n}qux\n');
});

test('separates moved comments from comments above them', async () => {
	const input = '# foo\nbar # baz\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'# foo\n#\n# baz\nbar\n'
	);
});

test('keeps suppression comments at the end of their lines', async () => {
	const input =
		'foo=bar # gitleaks:allow\nbaz=qux # pragma: allowlist secret\nquux # nosemgrep\ncorge # codespell:ignore\ngrault # cspell:disable-line\ngarply # NOSONAR\nwaldo=fred # trufflehog:ignore\nplugh=xyzzy # ggignore\nthud # pragma: allowlist nextline secret\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		input
	);
});

test('leaves comments in place when moving them would change the code', async () => {
	const input = 'foo="bar\nbaz" # qux\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		input
	);
});

test('leaves comments in place when removing them would continue the line', async () => {
	const input = 'echo foo\\  # bar\nbaz\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		input
	);
});

test('moves the other comments when one has to stay', async () => {
	const input = 'foo="bar\nbaz" # qux\nquux # corge\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'foo="bar\nbaz" # qux\n# corge\nquux\n'
	);
});

test('keeps directives, pragmas, and `prettier-ignore` markers at the end of their lines', async () => {
	const input =
		'foo # shellcheck disable=SC2086\nbar # @format\nbaz # prettier-ignore\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		input
	);
});

test('moves comments on `elif` and `else` lines into their branches', async () => {
	const input =
		'if foo; then\n  bar\nelif baz; then # qux\n  quux\nelse # corge\n  grault\nfi\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'if foo; then\n  bar\nelif baz; then\n  # qux\n  quux\nelse\n  # corge\n  grault\nfi\n'
	);
});

test('moves comments on continued `elif` lines into their branches', async () => {
	const input =
		'if foo; then\n  bar\nelif [[ -n "$baz" &&\n  -n "$qux" ]]; then # quux\n  corge\nfi\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'if foo; then\n  bar\nelif [[ -n "$baz" &&\n  -n "$qux" ]]; then\n  # quux\n  corge\nfi\n'
	);
});

test('moves comments above lines that only resemble branches', async () => {
	const input = 'elif=then # foo\nelif-bar then # baz\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'# foo\nelif=then\n# baz\nelif-bar then\n'
	);
});

test('separates moved comments from comments below them', async () => {
	const input = 'if foo; then\n  bar\nelse # baz\n  # qux\n  quux\nfi\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'if foo; then\n  bar\nelse\n  # baz\n  #\n  # qux\n  quux\nfi\n'
	);
});

test('separates moved comments from each other', async () => {
	const input = 'if foo; then\n  bar\nelse # baz\n  qux # quux\nfi\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'if foo; then\n  bar\nelse\n  # baz\n  #\n  # quux\n  qux\nfi\n'
	);
});

test('keeps `#!` comments at the end of their lines', async () => {
	const input = 'foo #!/bin/false\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		input
	);
});

test('ignores backslashes that don’t continue a command', async () => {
	const input =
		'# foo \\\nbar # baz\nqux \\\\\nquux # corge\ngrault \\|\ngarply # waldo\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'# foo \\\n#\n# baz\nbar\nqux \\\\\n# corge\nquux\ngrault \\|\n# waldo\ngarply\n'
	);
});

test('moves comments on lines continued with `&&` above their first line', async () => {
	const input = 'if [[ -n "$foo" &&\n  -n "$bar" ]]; then # baz\n  qux\nfi\n';

	await expect(moveTrailingComments(input, OPTIONS, reprint)).resolves.toBe(
		'# baz\nif [[ -n "$foo" &&\n  -n "$bar" ]]; then\n  qux\nfi\n'
	);
});

test('stops reprinting before a pass that adds a comment', async () => {
	const addComment = async (text: string): Promise<string> => {
		await Promise.resolve();
		return `${text}# foo\n`;
	};

	await expect(
		moveTrailingComments('bar # baz\n', OPTIONS, addComment)
	).resolves.toBe('# baz\nbar\n');
});

test('keeps comments in place when reprinting puts one back at the end of its line', async () => {
	const restoreComment = async (): Promise<string> => {
		await Promise.resolve();
		return 'foo  # bar\n';
	};

	await expect(
		moveTrailingComments('foo # bar\n', OPTIONS, restoreComment)
	).resolves.toBe('foo # bar\n');
});
