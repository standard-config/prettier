import type { Options, ParserOptions, Plugin } from 'prettier';
import type { PluginOptions } from './index.ts';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format } from 'prettier';
import { ParseError, print } from 'sh-syntax';
import { expect, expectTypeOf, onTestFinished, test, vi } from 'vite-plus/test';
import * as pluginShell from './index.ts';

const TEST_SHELL = `#!/bin/sh

# shellcheck source=./lib/common.sh
. "$(dirname "$0")/lib/common.sh"

# Keep two weeks of daily archives before the oldest ones are deleted, which
# matches
# the retention period of the offsite backups
RETENTION_DAYS=14

# Leave the tilde unexpanded, since the backup host resolves the archive path against its own home directory
# shellcheck disable=SC2088
ARCHIVE_DIR='~/Backups/logs'

# Compresses every log file in the current directory with one of these methods:
# - \`gzip\`, which is the default and runs on every supported system without extra packages
# - \`zstd\`, which compresses faster
#   but needs to be installed separately
#
# Arguments:
#   $1  Compression method, which falls back to \`gzip\` when the caller passes an empty value
compress_logs() {
  case "$1" in
    # Treat an empty method as the default, since cron jobs written before \`zstd\` support pass no argument at all
    '' | gzip)
      gzip -9 -- *.log # Overwrites existing archives, which only happens after an interrupted run
      ;;
  esac

  cat << EOF > README
# The nightly rotation job compresses the archives in this directory, so change the job instead of these files
EOF
}
`;

test('exposes correct public API', () => {
	expectTypeOf(pluginShell).toExtend<Plugin>();

	expect(pluginShell).toHaveProperty('languages');
	expect(pluginShell.languages).toMatchInlineSnapshot(`
		[
		  {
		    "aliases": [
		      "abuild",
		      "apkbuild",
		      "bash",
		      "envrc",
		      "husky",
		      "openrc",
		      "sh",
		      "shell-script",
		      "zsh",
		    ],
		    "extensions": [
		      ".bash",
		      ".bats",
		      ".command",
		      ".ebuild",
		      ".eclass",
		      ".ksh",
		      ".mksh",
		      ".sbatch",
		      ".sh",
		      ".sh.in",
		      ".slurm",
		      ".tmux",
		      ".tool",
		      ".zsh",
		      ".zsh-theme",
		    ],
		    "filenames": [
		      ".bash_aliases",
		      ".bash_functions",
		      ".bash_logout",
		      ".bash_profile",
		      ".bashrc",
		      ".envrc",
		      ".kshrc",
		      ".profile",
		      ".xinitrc",
		      ".xsession",
		      ".zlogin",
		      ".zlogout",
		      ".zprofile",
		      ".zshenv",
		      ".zshrc",
		      "APKBUILD",
		      "bash_aliases",
		      "bash_logout",
		      "bash_profile",
		      "bashrc",
		      "kshrc",
		      "PKGBUILD",
		      "xinitrc",
		      "xsession",
		      "zlogin",
		      "zlogout",
		      "zprofile",
		      "zshenv",
		      "zshrc",
		    ],
		    "interpreters": [
		      "ash",
		      "bash",
		      "bats",
		      "dash",
		      "ksh",
		      "mksh",
		      "openrc-run",
		      "pdksh",
		      "sh",
		      "zsh",
		    ],
		    "isSupported": [Function],
		    "name": "Shell",
		    "parsers": [
		      "sh",
		    ],
		    "vscodeLanguageIds": [
		      "shellscript",
		    ],
		  },
		]
	`);

	expect(pluginShell).toHaveProperty('options');
	expect(pluginShell.options).toHaveProperty('shCommentWrap');
	expect(pluginShell.options).toHaveProperty('shTabWidth.default', 2);
	expect(pluginShell.options).toHaveProperty('shUseTabs.default', false);

	expect(pluginShell).toHaveProperty('parsers');
	expect(pluginShell.parsers).toHaveProperty('sh');

	expect(pluginShell).toHaveProperty('printers');
	expect(pluginShell.printers).toHaveProperty('sh');

	expectTypeOf<PluginOptions>().toBeObject();
});

test('formats shell comments', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
	};

	const output = await format(TEST_SHELL, options);

	expect(output).toMatchSnapshot();
	await expect(format(output, options)).resolves.toBe(output);
});

test('keeps directives that cover the next line next to their code', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
	};

	const input = '# foo\n# nosemgrep: bar\neval "$baz" # qux\n';

	await expect(format(input, options)).resolves.toBe(input);
});

test('keeps a Semgrep marker immediately before the code it covers', async () => {
	const input =
		'# foo   bar\n# baz\n# NoSeM: local.demo\nfoo    bar # qux\n\n# NOSEMGREP: local.foo\nbar    baz # quux\n';
	const options = { parser: 'sh', plugins: [pluginShell] };

	const output = await format(input, options);

	expect(output).toBe(
		'# foo bar baz\n# NoSeM: local.demo\nfoo bar # qux\n\n# NOSEMGREP: local.foo\nbar baz # quux\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test('keeps Semgrep markers with the comment text they cover', async () => {
	const input = `# NoSeM: local.demo
#
foo    bar

# NOSEM
# foo bar baz qux quux corge TODO
# grault   garply
# waldo
bar    baz

# TODO sample with long prose mentioning a basic detail nosemgrep
# fred   plugh
baz    qux # fred NOSEM
# xyzzy   thud
# foo
qux    quux

# bar\tNoSeM: local.demo
# baz
#
# NoSoNaR qux   quux
# corge
quux    corge
`;
	const options = { parser: 'sh', plugins: [pluginShell], printWidth: 24 };

	const output = await format(input, options);

	expect(output).toBe(`# NoSeM: local.demo
#
foo bar

# NOSEM
# foo bar baz qux quux corge TODO
# grault garply waldo
bar baz

# TODO sample with long prose mentioning a basic detail nosemgrep
# fred plugh
baz qux # fred NOSEM
# xyzzy thud foo
qux quux

# bar\tNoSeM: local.demo
# baz
#
# NoSoNaR qux quux corge
quux corge
`);
	await expect(format(output, options)).resolves.toBe(output);
});

test('keeps Gitleaks suppressions on their original comment lines', async () => {
	const input = `# foo   bar
# baz
# gitleaks:allow
# qux quux corge grault garply gitleaks:allow
# waldo
# fred   plugh
foo # bargitleaks:allow
`;
	const options = { parser: 'sh', plugins: [pluginShell], printWidth: 25 };

	const output = await format(input, options);

	expect(output).toBe(`# foo bar baz
# gitleaks:allow
# qux quux corge grault garply gitleaks:allow
# waldo fred plugh
foo # bargitleaks:allow
`);
	await expect(format(output, options)).resolves.toBe(output);
});

test('keeps suppressions and their targets on their original comment lines', async () => {
	const input = `# preliminary words spill onto another line
# PLACEHOLDER sample text ggignore
# wrod sample text ; codespell:ignore wrod
# fooo sample text SpElL-ChEcKeR: disable-line
# PLACEHOLDER sample text # ggignore
# PLACEHOLDER sample text trufflehog:ignore
# PLACEHOLDER sample text // pragma: allowlist secret
# codespell:ignore-next-line wrod
# wrod these words must stay on the original line
# pragma: allowlist nextline secret
foo # PLACEHOLDER remains on this line
bar # ggignore
baz # this unrelated note can move
echo "; codespell:ignore wrod" # wrod text
`;
	const options = { parser: 'sh', plugins: [pluginShell], printWidth: 30 };

	const output = await format(input, options);

	expect(output).toBe(`# preliminary words spill onto
# another line PLACEHOLDER
# sample text ggignore
# wrod sample text ; codespell:ignore wrod
# fooo sample text SpElL-ChEcKeR: disable-line
# PLACEHOLDER sample text # ggignore
# PLACEHOLDER sample text trufflehog:ignore
# PLACEHOLDER sample text // pragma: allowlist secret
# codespell:ignore-next-line wrod
# wrod these words must stay on the original line
# pragma: allowlist nextline secret
foo # PLACEHOLDER remains on this line
bar # ggignore
# this unrelated note can move
baz
echo "; codespell:ignore wrod" # wrod text
`);
	await expect(format(output, options)).resolves.toBe(output);
});

test('reflows line comment list prose below protected lines', async () => {
	const input = `# 1. foo   bar gitleaks:allow
#    baz   qux quux corge grault garply waldo fred plugh xyzzy
#    - thud gitleaks:allow
#      foo   bar baz qux quux corge grault garply waldo
# - fred
#   plugh   xyzzy gitleaks:allow
#   thud   foo bar baz qux quux corge grault garply waldo
# - foo
#   region foo gitleaks:allow
#   bar   baz
foo
`;
	const options = { parser: 'sh', plugins: [pluginShell], printWidth: 40 };

	const output = await format(input, options);

	expect(output).toBe(`# 1. foo   bar gitleaks:allow
#    baz qux quux corge grault garply
#    waldo fred plugh xyzzy
#    - thud gitleaks:allow
#      foo bar baz qux quux corge grault
#      garply waldo
# - fred
#   plugh   xyzzy gitleaks:allow
#   thud foo bar baz qux quux corge
#   grault garply waldo
# - foo
#   region foo gitleaks:allow
#   bar   baz
foo
`);
	await expect(format(output, options)).resolves.toBe(output);
});

test('keeps wrapped comments from starting lines with directives that cover the next line', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		printWidth: 40,
	};

	const output = await format(
		'# foo bar baz qux quux corge grault pragma: allowlist nextline secret\nfoo=bar\n',
		options
	);

	expect(output).toBe(
		'# foo bar baz qux quux corge grault pragma:\n# allowlist nextline secret\nfoo=bar\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test('leaves code formatting to `sh-syntax`', async () => {
	const input = 'if [ -n "$foo" ]\nthen\n    # bar\n    baz    qux\nfi\n';

	const expectedOutput = await print(input, { simplify: true });

	const options = { parser: 'sh', plugins: [pluginShell] };

	const output = await format(input, options);

	expect(output).toBe(expectedOutput);
	await expect(format(output, options)).resolves.toBe(output);
});

test('reports syntax errors with their position', async () => {
	const input = 'echo é\necho 😀 )\n';
	let result: unknown;

	try {
		await format(input, { filepath: 'foo.sh', plugins: [pluginShell] });
	} catch (error) {
		result = error;
	}

	expect(result).toBeInstanceOf(ParseError);
	expect(result).toHaveProperty(
		'text',
		'a command can only contain words and redirects; encountered `)`'
	);
	expect(result).toHaveProperty('pos', { column: 10, line: 2, offset: 18 });
	expect(result).toHaveProperty('loc', { start: { column: 9, line: 2 } });
	expect(result).toHaveProperty('codeFrame', expect.stringContaining('^'));
});

test.each([
	[
		'parse errors without a position',
		new ParseError({ incomplete: false, text: 'foo' }),
	],
	[
		'other errors with a position',
		Object.assign(new Error('foo'), {
			pos: { column: 0, line: 1, offset: 0 },
		}),
	],
])('preserves %s from `sh-syntax`', async (_description, error) => {
	vi.resetModules();
	vi.doMock('sh-syntax', async (importOriginal) => ({
		...(await importOriginal()),
		processor: vi.fn().mockRejectedValue(error),
	}));
	onTestFinished(() => {
		vi.doUnmock('sh-syntax');
		vi.resetModules();
	});
	const plugin = await import('./index.ts');

	await expect(
		format('foo\n', { filepath: 'foo.sh', plugins: [plugin] })
	).rejects.toBe(error);
	expect(error).not.toHaveProperty('loc');
});

test('formats comments in shell scripts', async () => {
	const options = {
		filepath: 'foo.sh',
		plugins: [pluginShell],
		printWidth: 20,
	};

	const output = await format('# foo bar baz qux quux corge\nfoo\n', options);

	expect(output).toBe('# foo bar baz qux\n# quux corge\nfoo\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test.each(['.husky/foo', 'APKBUILD', 'foo.ebuild', 'foo.eclass'])(
	'formats `%s` like shell scripts',
	async (filepath) => {
		const options = { filepath, plugins: [pluginShell], printWidth: 20 };

		const output = await format(
			'# foo bar baz qux quux corge\n# grault\nfoo=$(( $bar ))\n',
			options
		);

		expect(output).toBe(
			'# foo bar baz qux\n# quux corge grault\nfoo=$((bar))\n'
		);
		await expect(format(output, options)).resolves.toBe(output);
	}
);

test('formats OpenRC runscripts like shell scripts', async () => {
	using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
	const input =
		'#!/usr/bin/env openrc-run\n# foo bar baz qux quux corge\n# grault\nfoo=$(( $bar ))\n';
	const filepath = join(directory.path, 'foo');
	writeFileSync(filepath, input);
	const options = { filepath, plugins: [pluginShell], printWidth: 20 };

	const output = await format(input, options);

	expect(output).toBe(
		'#!/usr/bin/env openrc-run\n\n# foo bar baz qux\n# quux corge grault\nfoo=$((bar))\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats Bats files without an extension', async () => {
	using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
	const input = '#!/usr/bin/env bats\n@test "foo" {\n  run bar # baz\n}\n';
	const filepath = join(directory.path, 'foo');
	writeFileSync(filepath, input);
	const options = { filepath, plugins: [pluginShell] };

	const output = await format(input, options);

	expect(output).toBe(
		'#!/usr/bin/env bats\n\n@test "foo" {\n  # baz\n  run bar\n}\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test('doesn’t format rc scripts', async () => {
	using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
	const input = '#!/usr/bin/env rc\nfoo\n';
	const filepath = join(directory.path, 'foo');
	writeFileSync(filepath, input);

	await expect(
		format(input, { filepath, plugins: [pluginShell] })
	).rejects.toThrow('No parser could be inferred');
});

test.each([
	{
		input: 'if [[ -n $foo &&\n  -n $bar ]]; then # baz\n  qux\nfi\n',
		output: '# baz\nif [[ -n $foo\n  && -n $bar ]]; then\n  qux\nfi\n',
	},
	{
		input: 'if foo; then\n  bar\nelif [[ -n $baz &&\n  -n $qux ]]; then # quux\n  corge\nfi\n',
		output: 'if foo; then\n  bar\nelif [[ -n $baz\n  && -n $qux ]]; then\n  # quux\n  corge\nfi\n',
	},
	{
		input: 'if (( foo &&\n  bar )); then # baz\n  qux\nfi\n',
		output: '# baz\nif ((foo\n  && bar)); then\n  qux\nfi\n',
	},
	{
		input: 'while [[ -n $foo ||\n  -n $bar ]]; do # baz\n  qux\ndone\n',
		output: '# baz\nwhile [[ -n $foo\n  || -n $bar ]]; do\n  qux\ndone\n',
	},
])(
	'moves trailing comments on conditions continued with `&&` or `||`',
	async ({ input, output: expectedOutput }) => {
		const options = { filepath: 'foo.sh', plugins: [pluginShell] };

		const output = await format(input, options);

		expect(output).toBe(expectedOutput);
		await expect(format(output, options)).resolves.toBe(output);
	}
);

test('keeps trailing comments on arithmetic continued with other operators', async () => {
	const options = { filepath: 'foo.sh', plugins: [pluginShell] };

	const output = await format('foo=$(( bar +\n  baz )) # qux\n', options);

	expect(output).toBe('foo=$((bar\n  + baz)) # qux\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('moves other trailing comments past one that stays on continued arithmetic', async () => {
	const options = { filepath: 'foo.sh', plugins: [pluginShell] };

	const output = await format(
		'foo=$((bar +\n  baz)) # qux\nquux # corge\n',
		options
	);

	expect(output).toBe('foo=$((bar\n  + baz)) # qux\n# corge\nquux\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('moves comments on string lines that start with `&&` above the command', async () => {
	const options = { filepath: 'foo.sh', plugins: [pluginShell] };

	const output = await format('echo "foo\n&& bar" # baz\n', options);

	expect(output).toBe('# baz\necho "foo\n&& bar"\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('keeps comments out of strings with lines that start with `&&`', async () => {
	const input = 'echo "foo\nbar\n&& baz" # qux\n';

	await expect(
		format(input, { filepath: 'foo.sh', plugins: [pluginShell] })
	).resolves.toBe(input);
});

test('keeps scheduler directives as written', async () => {
	const options = {
		filepath: 'foo.sh',
		plugins: [pluginShell],
		printWidth: 20,
	};

	const output = await format(
		'#!/bin/bash\n#SBATCH --job-name=foo\n#SBATCH --time=01:00:00\n# SBATCH --mem=1G\nbar\n',
		options
	);

	expect(output).toBe(
		'#!/bin/bash\n\n#SBATCH --job-name=foo\n#SBATCH --time=01:00:00\n# SBATCH --mem=1G\nbar\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test.each([
	{
		output: '# foo bar SBATCH\n# baz qux $\n# quux SBATCH\n# --corge $\n# -grault\n# garply\nwaldo\n',
		printWidth: 12,
	},
	{
		output: '# foo bar SBATCH\n# baz qux $ quux SBATCH\n# --corge $\n# -grault garply\nwaldo\n',
		printWidth: 16,
	},
	{
		output: '# foo bar SBATCH baz qux $ quux SBATCH\n# --corge $ -grault garply\nwaldo\n',
		printWidth: 32,
	},
])(
	'keeps wrapped comments from starting lines with scheduler directives at a width of $printWidth',
	async ({ output: expectedOutput, printWidth }) => {
		const options = {
			filepath: 'foo.sh',
			plugins: [pluginShell],
			printWidth,
		};

		const output = await format(
			'# foo bar SBATCH baz qux $ quux SBATCH --corge $ -grault garply\nwaldo\n',
			options
		);

		expect(output).toBe(expectedOutput);
		await expect(format(output, options)).resolves.toBe(output);
	}
);

test('keeps trailing scheduler directives at the end of their lines', async () => {
	const input = 'foo # SBATCH --time=1\nbar #$ -cwd\n';

	await expect(
		format(input, { filepath: 'foo.sh', plugins: [pluginShell] })
	).resolves.toBe(input);
});

test('keeps other forms of scheduler directives as written', async () => {
	const options = {
		filepath: 'foo.sh',
		plugins: [pluginShell],
		printWidth: 20,
	};
	const attached = '#SBATCH--time=01:00:00\n#PBS-N foo\nbar\n';
	const quoted = '#SBATCH "--time=01:00:00"\nfoo\n';
	const continued = "#PBS -v 'FOO=foo \\\n#bar baz qux quux corge'\nfoo\n";
	const disabled = '# #SBATCH --time=01:00:00\nfoo\n';
	const heterogeneousJob =
		'#SBATCH --nodes=1\n#SBATCH hetjob # second component\n#SBATCH --nodes=2\n#SBATCH hetjob --nodes=3\nfoo\n';
	const flux =
		'# flux: --setattr=user.conf="""\n# flux: [config]\n# flux:   item = "foo"\n# flux: """\nfoo\n';

	await expect(format(attached, options)).resolves.toBe(attached);
	await expect(format(quoted, options)).resolves.toBe(quoted);
	await expect(format(continued, options)).resolves.toBe(continued);
	await expect(format(disabled, options)).resolves.toBe(disabled);
	await expect(format(heterogeneousJob, options)).resolves.toBe(
		heterogeneousJob
	);
	await expect(format(flux, options)).resolves.toBe(flux);
});

test.each([
	{
		input: '#SBATCH --time=01:00:00\ntrue # a trailing prose comment to move\n',
		output: '#SBATCH --time=01:00:00\n# a trailing prose comment to move\ntrue\n',
	},
	{
		input: 'if foo; then\n  true\nelse # a prose comment to move\n  #SBATCH --time=01:00:00\n  bar\nfi\n',
		output: 'if foo; then\n  true\nelse\n  # a prose comment to move\n  #SBATCH --time=01:00:00\n  bar\nfi\n',
	},
	{
		input: "#PBS -v 'FOO=foo \\\n#bar baz quux'\ntrue # a trailing prose comment to move\n",
		output: "#PBS -v 'FOO=foo \\\n#bar baz quux'\n# a trailing prose comment to move\ntrue\n",
	},
])(
	'doesn’t separate moved comments from scheduler directives',
	async ({ input, output: expectedOutput }) => {
		const options = { filepath: 'foo.sh', plugins: [pluginShell] };

		const output = await format(input, options);

		expect(output).toBe(expectedOutput);
		await expect(format(output, options)).resolves.toBe(output);
	}
);

test('reflows comments that start with `$-` and no option', async () => {
	const options = {
		filepath: 'foo.sh',
		plugins: [pluginShell],
		printWidth: 20,
	};

	const output = await format(
		'# $- holds the current shell flags\nfoo\n',
		options
	);

	expect(output).toBe('# $- holds the\n# current shell\n# flags\nfoo\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test.each([
	{
		input: '#PBS -N foo \\\n#\nbar    baz\n',
		output: '#PBS -N foo \\\n#\nbar baz\n',
	},
	{
		input: '#PBS -N foo \\\n#bar \\\n#\nbaz    qux\n',
		output: '#PBS -N foo \\\n#bar \\\n#\nbaz qux\n',
	},
])(
	'keeps empty lines that continue PBS directives',
	async ({ input, output: expectedOutput }) => {
		const options = { filepath: 'foo.sh', plugins: [pluginShell] };

		const output = await format(input, options);

		expect(output).toBe(expectedOutput);
		await expect(format(output, options)).resolves.toBe(output);
	}
);

test.each([
	{
		input: '#PBS -N foo\n#\nbar    baz\n',
		output: '#PBS -N foo\nbar baz\n',
	},
	{
		input: '#SBATCH --time=1 \\\n#\nbar    baz\n',
		output: '#SBATCH --time=1 \\\nbar baz\n',
	},
])(
	'removes empty lines that end comments after scheduler directives that don’t continue',
	async ({ input, output: expectedOutput }) => {
		const options = { filepath: 'foo.sh', plugins: [pluginShell] };

		const output = await format(input, options);

		expect(output).toBe(expectedOutput);
		await expect(format(output, options)).resolves.toBe(output);
	}
);

test('keeps code fences in comments as written', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		printWidth: 20,
	};

	const output = await format(
		'# foo:\n#\n# ```sh\n# bar  baz\n# ```\n# qux quux corge grault\nfoo\n',
		options
	);

	expect(output).toBe(
		'# foo:\n#\n# ```sh\n# bar  baz\n# ```\n# qux quux corge\n# grault\nfoo\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test('respects `printWidth`', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		printWidth: 12,
	};

	const output = await format('# foo bar baz qux\n', options);

	expect(output).toBe('# foo bar\n# baz qux\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('supports `shTabWidth`', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		shTabWidth: 4,
	};

	const output = await format('foo() {\nbar\n}\n', options);

	expect(output).toBe('foo() {\n    bar\n}\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('supports `shUseTabs`', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		printWidth: 16,
		shTabWidth: 4,
		shUseTabs: true,
	};

	const output = await format(
		'foo() {\n  # bar baz qux\n  quux\n}\n',
		options
	);

	expect(output).toBe('foo() {\n\t# bar baz\n\t# qux\n\tquux\n}\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('ignores Prettier’s indentation options', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		tabWidth: 4,
		useTabs: true,
	};

	const output = await format('foo() {\nbar\n}\n', options);

	expect(output).toBe('foo() {\n  bar\n}\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('simplifies shell scripts', async () => {
	const options = { filepath: 'foo.sh', plugins: [pluginShell] };

	const output = await format('foo=$(( $bar + 1 ))\n', options);

	expect(output).toBe('foo=$((bar + 1))\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats shell scripts whose names start with `.env.`', async () => {
	const options = { filepath: '.env.sh', plugins: [pluginShell] };

	const output = await format(
		'#!/bin/sh\n# foo\n# bar\nbaz=$(( $qux )) # quux\n',
		options
	);

	expect(output).toBe('#!/bin/sh\n\n# foo bar\n#\n# quux\nbaz=$((qux))\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('doesn’t format Dockerfiles', async () => {
	const options = { plugins: [pluginShell] };

	await expect(
		format('FROM foo\n', { ...options, filepath: 'Dockerfile' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('FROM foo\n', { ...options, parser: 'dockerfile' })
	).rejects.toThrow('resolve parser "dockerfile"');
	await expect(
		format('```dockerfile\nFROM   foo\n```\n', {
			...options,
			filepath: 'foo.md',
		})
	).resolves.toBe('```dockerfile\nFROM   foo\n```\n');
});

test('doesn’t format data files or shells with incompatible syntax', async () => {
	const options = { plugins: [pluginShell] };

	await expect(
		format('foo\n', { ...options, filepath: '.env' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.env.local' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.gitattributes' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.gitignore' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.nvmrc' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.rspec' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.tm_properties' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'CODEOWNERS' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.ics' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.nu' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.pc' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.properties' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.tcsh' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.vcf' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.vmoptions' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'hosts' })
	).rejects.toThrow('No parser could be inferred');
});

test('doesn’t format files outside the supported shell names', async () => {
	const options = { plugins: [pluginShell] };

	await expect(
		format('foo\n', { ...options, filepath: '.bash_history' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.cshrc' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.login' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.tmux.conf' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '9fs' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'cshrc' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.cgi' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.fcgi' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'foo.trigger' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'gradlew' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'login' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'man' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'mvnw' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'profile' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: 'tmux.conf' })
	).rejects.toThrow('No parser could be inferred');
});

test('doesn’t format other files in `.husky` directories', async () => {
	const options = { plugins: [pluginShell] };

	await expect(
		format('foo\n', { ...options, filepath: '.husky/.gitignore' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.husky/foo.bar' })
	).rejects.toThrow('No parser could be inferred');
	await expect(
		format('foo\n', { ...options, filepath: '.husky/foo/bar' })
	).rejects.toThrow('No parser could be inferred');
});

test('doesn’t format `.flaskenv` files', async () => {
	await expect(
		format('foo\n', { filepath: '.flaskenv', plugins: [pluginShell] })
	).rejects.toThrow('No parser could be inferred');
});

test('keeps data code blocks in Markdown as written', async () => {
	const input =
		'```dotenv\nFOO=$(($BAR + 1))\n```\n\n```gitignore\nfoo # bar\n```\n\n```properties\nfoo=bar # baz\n```\n';

	await expect(
		format(input, { filepath: 'foo.md', plugins: [pluginShell] })
	).resolves.toBe(input);
});

test('formats shell code in Markdown like shell scripts', async () => {
	const options = { filepath: 'foo.md', plugins: [pluginShell], tabWidth: 4 };

	const output = await format(
		'```sh\nfoo() {\nbar=$(( $baz ))\n}\n```\n',
		options
	);

	expect(output).toBe('```sh\nfoo() {\n  bar=$((baz))\n}\n```\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('adds an empty line after a shebang', async () => {
	const options = { filepath: 'foo.sh', plugins: [pluginShell] };

	const output = await format('#!/bin/sh\n# foo\nbar\n', options);

	expect(output).toBe('#!/bin/sh\n\n# foo\nbar\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test.each([
	{
		input: '#! /usr/bin/env nix-shell\n#! nix-shell -i bash -p jq\njq --version\n',
		output: '#! /usr/bin/env nix-shell\n#! nix-shell -i bash -p jq\n\njq --version\n',
	},
	{
		input: '#! /usr/bin/env nix-shell\n#! nix-shell -i bash -p jq\n# foo   bar\njq --version\n',
		output: '#! /usr/bin/env nix-shell\n#! nix-shell -i bash -p jq\n\n# foo bar\njq --version\n',
	},
])(
	'keeps `#!` lines below a shebang together',
	async ({ input, output: expectedOutput }) => {
		const options = { filepath: 'foo.sh', plugins: [pluginShell] };

		const output = await format(input, options);

		expect(output).toBe(expectedOutput);
		await expect(format(output, options)).resolves.toBe(output);
	}
);

test('adds an empty line after a shebang when comments are left as written', async () => {
	const options = {
		filepath: 'foo.sh',
		plugins: [pluginShell],
		shCommentWrap: 'none',
	} satisfies Options;

	const output = await format('#!/bin/sh\nfoo # bar\n', options);

	expect(output).toBe('#!/bin/sh\n\nfoo # bar\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('adds an empty line after a shebang in shell code in Markdown', async () => {
	const options = { filepath: 'foo.md', plugins: [pluginShell] };

	const output = await format('```sh\n#!/bin/sh\nfoo\n```\n', options);

	expect(output).toBe('```sh\n#!/bin/sh\n\nfoo\n```\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats Bats files', async () => {
	const options = {
		filepath: 'foo.bats',
		plugins: [pluginShell],
		printWidth: 20,
	};

	const output = await format(
		'@test "foo" {\n  # bar baz qux quux corge\n  run grault # garply\n}\n',
		options
	);

	expect(output).toBe(
		'@test "foo" {\n  # bar baz qux quux\n  # corge\n  #\n  # garply\n  run grault\n}\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats Bats code in Markdown after a Bats shebang', async () => {
	const options = { filepath: 'foo.md', plugins: [pluginShell] };

	const output = await format(
		'```bats\n#!/usr/bin/env bats\n@test "foo" {\n  run bar # baz\n}\n```\n',
		options
	);

	expect(output).toBe(
		'```bats\n#!/usr/bin/env bats\n\n@test "foo" {\n  # baz\n  run bar\n}\n```\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats mksh scripts', async () => {
	const options = { filepath: 'foo.sh', plugins: [pluginShell] };

	const output = await format('#!/bin/mksh\nfoo |& # bar\n', options);

	expect(output).toBe('#!/bin/mksh\n\n# bar\nfoo |&\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats `.mksh` files as mksh', async () => {
	const options = { filepath: 'foo.mksh', plugins: [pluginShell] };

	const output = await format('foo |& # bar\n', options);

	expect(output).toBe('# bar\nfoo |&\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('keeps Bats `@test` comments on their function lines', async () => {
	const input = 'foo() { # @test\n  run bar\n}\n';

	await expect(
		format(input, { filepath: 'foo.bats', plugins: [pluginShell] })
	).resolves.toBe(input);
});

test('reflows full-line `@test` comments as text', async () => {
	const options = {
		filepath: 'foo.bats',
		plugins: [pluginShell],
		printWidth: 10,
	};

	const output = await format('# foo @test\nfoo\n', options);

	expect(output).toBe('# foo\n# @test\nfoo\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats scripts with `@noformat` when `checkIgnorePragma` is enabled', async () => {
	const input = '# @noformat\nfoo    bar\n';

	const expectedOutput = await format(input, {
		parser: 'sh',
		plugins: [pluginShell],
	});

	const options = {
		checkIgnorePragma: true,
		parser: 'sh',
		plugins: [pluginShell],
	};

	const output = await format(input, options);

	expect(output).toBe(expectedOutput);
	await expect(format(output, options)).resolves.toBe(output);
});

test('leaves the script without a pragma when `insertPragma` is enabled', async () => {
	const input = 'foo    bar\n';

	const expectedOutput = await format(input, {
		parser: 'sh',
		plugins: [pluginShell],
	});

	const options = {
		insertPragma: true,
		parser: 'sh',
		plugins: [pluginShell],
	};

	const output = await format(input, options);

	expect(output).toBe(expectedOutput);
	await expect(format(output, options)).resolves.toBe(output);
});

test('respects `requirePragma`', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		requirePragma: true,
	};

	const output = await format('# foo\n# @format\nbar    baz\n', options);

	expect(output).toBe('# foo\n#\n# @format\nbar baz\n');
	await expect(format(output, options)).resolves.toBe(output);

	await expect(
		format(output.replace('bar baz', 'bar    baz'), options)
	).resolves.toBe(output);
	await expect(format('foo    bar\n', options)).resolves.toBe('foo    bar\n');
});

test('finds a pragma surrounded by whitespace after a shebang and blank lines', async () => {
	const input = '#!/bin/sh\r\n\r\n\t#\t@prettier \t\r\nfoo    bar\r\n';
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		requirePragma: true,
	};

	const output = await format(input, options);

	expect(output).toBe('#!/bin/sh\n\n#\t@prettier\nfoo bar\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('requires a complete pragma on its own line before the first command', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		requirePragma: true,
	};
	const longerWord = '# @formatting\nfoo    bar\n';
	const followingText = '# @prettier foo\nfoo    bar\n';
	const embeddedLineSeparator = '# @format\u2028foo\nfoo    bar\n';
	const precedingText = '# foo @format\nfoo    bar\n';
	const extraHash = '## @format\nfoo    bar\n';
	const afterCommand = 'foo    bar\n# @prettier\n';
	const nonbreakingSpaceCommand = '\u00A0\n# @format\nfoo    bar\n';
	const trailingComment = 'foo    bar # @format\n';
	const commentsOnly = '# foo    bar\n';

	await expect(format(longerWord, options)).resolves.toBe(longerWord);
	await expect(format(followingText, options)).resolves.toBe(followingText);
	await expect(format(embeddedLineSeparator, options)).resolves.toBe(
		embeddedLineSeparator
	);
	await expect(format(precedingText, options)).resolves.toBe(precedingText);
	await expect(format(extraHash, options)).resolves.toBe(extraHash);
	await expect(format(afterCommand, options)).resolves.toBe(afterCommand);
	await expect(format(nonbreakingSpaceCommand, options)).resolves.toBe(
		nonbreakingSpaceCommand
	);
	await expect(format(trailingComment, options)).resolves.toBe(
		trailingComment
	);
	await expect(format(commentsOnly, options)).resolves.toBe(commentsOnly);
});

test('wraps leading prose containing pragma words and prefixes', async () => {
	const input =
		'# foo bar baz @format qux\n#\n# @prettier foo bar baz\n#\n# foo bar baz @formatting\nfoo    bar\n';
	const options = { parser: 'sh', plugins: [pluginShell], printWidth: 13 };

	const output = await format(input, options);

	expect(output).toBe(
		'# foo bar baz\n# @format qux\n#\n# @prettier foo\n# bar baz\n#\n# foo bar baz\n# @formatting\nfoo bar\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
});

test.each([
	{
		case: 'nonbreaking space before a pragma word',
		input: `# foo bar baz qux quux corge grault garply waldo fred plugh xyzzy thud \u00A0@format
#
# - foo bar baz qux quux corge grault garply waldo @prettier
#
# foo bar baz qux
foo    bar
`,
		output: `# foo bar baz
# qux quux
# corge
# grault
# garply
# waldo fred
# plugh xyzzy
# thud \u00A0@format
#
# - foo bar
#   baz qux
#   quux
#   corge
#   grault
#   garply
#   waldo @prettier
#
# foo bar baz
# qux
foo bar
`,
	},
	{
		case: 'Unicode line separator in a comment',
		input: '# foo\u2028bar\n# foo bar baz @format\nfoo    bar\n',
		output: '# foo\u2028bar foo\n# bar baz @format\nfoo bar\n',
	},
])(
	'wraps leading comments containing a $case without creating a pragma',
	async ({ input, output: expectedOutput }) => {
		const options = {
			parser: 'sh',
			plugins: [pluginShell],
			printWidth: 13,
		};

		const output = await format(input, options);

		expect(output).toBe(expectedOutput);
		await expect(format(output, options)).resolves.toBe(output);

		const unformatted = output.replace('\nfoo bar\n', '\nfoo    bar\n');
		await expect(
			format(unformatted, { ...options, requirePragma: true })
		).resolves.toBe(unformatted);
	}
);

test('preserves a pragma after a nonbreaking space between leading comments', async () => {
	const input = '# foo   bar\n#\u00A0@format\n# baz   qux\ncorge    grault\n';
	const options = { parser: 'sh', plugins: [pluginShell] };

	const output = await format(input, options);

	expect(output).toBe(
		'# foo bar\n#\n#\u00A0@format\n#\n# baz qux\ncorge grault\n'
	);
	await expect(format(output, options)).resolves.toBe(output);
	await expect(
		format(output.replace('corge grault', 'corge    grault'), {
			...options,
			requirePragma: true,
		})
	).resolves.toBe(output);
});

test('finds a leading pragma after standalone shell continuations', async () => {
	const input = '  \\\n# foo \\\n\\\n# @prettier\nfoo    bar\n';
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		requirePragma: true,
	};

	const output = await format(input, options);

	expect(output).toBe('# foo \\\n\n# @prettier\nfoo bar\n');
	await expect(format(output, options)).resolves.toBe(output);
	await expect(
		format(output.replace('foo bar', 'foo    bar'), options)
	).resolves.toBe(output);
});

test('leaves scripts without an active leading pragma unformatted', async () => {
	const command = 'foo \\\n# @format\nbar    baz\n';
	const escapedBackslash = '\\\\\n# @format\nfoo    bar\n';
	const splitComment = '# @for\\\n\\\n# mat\nfoo    bar\n';
	const escapedSpace = '\\ \n# @format\nfoo    bar\n';
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		requirePragma: true,
	};

	await expect(format(command, options)).resolves.toBe(command);
	await expect(format(escapedBackslash, options)).resolves.toBe(
		escapedBackslash
	);
	await expect(format(splitComment, options)).resolves.toBe(splitComment);
	await expect(format(escapedSpace, options)).resolves.toBe(escapedSpace);
});

test('keeps a trailing pragma on the same line as its command', async () => {
	const input = 'foo    bar #\u00A0@format\n';
	const options = { parser: 'sh', plugins: [pluginShell] };

	const output = await format(input, options);

	expect(output).toBe('foo bar #\u00A0@format\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('locates syntax tree nodes', async () => {
	const parser = pluginShell.parsers!.sh!;

	const ast = await parser.parse('foo\nbar\n', {
		filepath: 'foo.sh',
	} as ParserOptions);

	expect(parser.locStart(ast)).toBe(0);
	expect(parser.locEnd(ast)).toBe(7);
});

test('supports `shCommentWrap`', async () => {
	const input = '# foo bar baz\n# qux\ncorge # grault\n';
	const options = {
		parser: 'sh',
		plugins: [pluginShell],
		printWidth: 20,
	};

	const outputs = {
		'all': await format(input, {
			...options,
			shCommentWrap: 'all',
		}),
		'full-line': await format(input, {
			...options,
			shCommentWrap: 'full-line',
		}),
		'none': await format(input, {
			...options,
			shCommentWrap: 'none',
		}),
	};

	expect(outputs).toStrictEqual({
		'all': '# foo bar baz qux\n#\n# grault\ncorge\n',
		'full-line': '# foo bar baz qux\ncorge # grault\n',
		'none': await print(input, { simplify: true }),
	});
	await expect(format(outputs.all, options)).resolves.toBe(outputs.all);
	await expect(
		format(outputs['full-line'], {
			...options,
			shCommentWrap: 'full-line',
		})
	).resolves.toBe(outputs['full-line']);
});
