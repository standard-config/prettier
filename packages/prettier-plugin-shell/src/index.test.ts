import type { Options, Plugin } from 'prettier';
import type { PluginOptions } from './index.ts';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format } from 'prettier';
import * as pluginSh from 'prettier-plugin-sh';
import { expect, expectTypeOf, test } from 'vite-plus/test';
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

	const shLanguages = new Map(
		pluginSh.languages.map((language) => [language.name, language])
	);
	const shell = shLanguages.get('Shell')!;

	expect(pluginShell).toHaveProperty('languages', [
		shLanguages.get('Alpine Abuild'),
		shLanguages.get('Gentoo Ebuild'),
		shLanguages.get('Gentoo Eclass'),
		shLanguages.get('OpenRC runscript'),
		{
			...shell,
			filenames: shell.filenames!.filter(
				(filename) => filename !== '.flaskenv'
			),
		},
		shLanguages.get('husky'),
	]);

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

test('leaves code formatting to `prettier-plugin-sh`', async () => {
	const input = 'if [ -n "$foo" ]\nthen\n    # bar\n    baz    qux\nfi\n';

	const expectedOutput = await format(input, {
		parser: 'sh',
		plugins: [pluginSh],
		simplify: true,
	});

	const options = { parser: 'sh', plugins: [pluginShell] };

	const output = await format(input, options);

	expect(output).toBe(expectedOutput);
	await expect(format(output, options)).resolves.toBe(output);
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

test('respects `checkIgnorePragma`', async () => {
	const input = '# @noformat\nfoo    bar\n';

	const expectedOutput = await format(input, {
		checkIgnorePragma: true,
		parser: 'sh',
		plugins: [pluginSh],
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

test('respects `insertPragma`', async () => {
	const input = 'foo    bar\n';

	const expectedOutput = await format(input, {
		insertPragma: true,
		parser: 'sh',
		plugins: [pluginSh],
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
		'none': await format(input, {
			parser: 'sh',
			plugins: [pluginSh],
			printWidth: 20,
		}),
	});
	await expect(format(outputs.all, options)).resolves.toBe(outputs.all);
	await expect(
		format(outputs['full-line'], {
			...options,
			shCommentWrap: 'full-line',
		})
	).resolves.toBe(outputs['full-line']);
});
