import type { Plugin } from 'prettier';
import type { PluginOptions } from './index.ts';
import { format } from 'prettier';
import * as pluginSh from 'prettier-plugin-sh';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import * as pluginShellComments from './index.ts';

const TEST_SH = `#!/bin/sh

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
	expectTypeOf(pluginShellComments).toExtend<Plugin>();

	expect(pluginShellComments).toHaveProperty('options');
	expect(pluginShellComments).toHaveProperty('parsers');
	expect(pluginShellComments).toHaveProperty('printers');

	expect(pluginShellComments.parsers).toHaveProperty('sh');
	expect(pluginShellComments.printers).toHaveProperty('sh');

	expectTypeOf<PluginOptions>().toBeObject();
});

test('formats shell comments', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShellComments],
	};

	const output = await format(TEST_SH, options);

	expect(output).toMatchSnapshot();
	await expect(format(output, options)).resolves.toBe(output);
});

test('leaves code formatting to `prettier-plugin-sh`', async () => {
	const input = 'if [ -n "$foo" ]\nthen\n    # bar\n    baz    qux\nfi\n';

	const expectedOutput = await format(input, {
		parser: 'sh',
		plugins: [pluginSh],
	});

	const options = { parser: 'sh', plugins: [pluginShellComments] };

	const output = await format(input, options);

	expect(output).toBe(expectedOutput);
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats comments when listed after `prettier-plugin-sh`', async () => {
	const options = {
		filepath: 'foo.sh',
		plugins: [pluginSh, pluginShellComments],
		printWidth: 20,
	};

	const output = await format('# foo bar baz qux quux corge\nfoo\n', options);

	expect(output).toBe('# foo bar baz qux\n# quux corge\nfoo\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('formats comments in other files that use the `sh` parser', async () => {
	const options = {
		filepath: '.gitignore',
		plugins: [pluginSh, pluginShellComments],
		printWidth: 20,
	};

	const output = await format(
		'# foo bar baz qux quux corge\n# grault\nfoo\n',
		options
	);

	expect(output).toBe('# foo bar baz qux\n# quux corge\n# grault\nfoo\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('respects `printWidth`', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShellComments],
		printWidth: 12,
	};

	const output = await format('# foo bar baz qux\n', options);

	expect(output).toBe('# foo bar\n# baz qux\n');
	await expect(format(output, options)).resolves.toBe(output);
});

test('respects `useTabs`', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShellComments],
		printWidth: 16,
		tabWidth: 4,
		useTabs: true,
	};

	const output = await format(
		'foo() {\n  # bar baz qux\n  quux\n}\n',
		options
	);

	expect(output).toBe('foo() {\n\t# bar baz\n\t# qux\n\tquux\n}\n');
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
		plugins: [pluginShellComments],
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
		plugins: [pluginShellComments],
	};

	const output = await format(input, options);

	expect(output).toBe(expectedOutput);
	await expect(format(output, options)).resolves.toBe(output);
});

test('respects `requirePragma`', async () => {
	const options = {
		parser: 'sh',
		plugins: [pluginShellComments],
		requirePragma: true,
	};

	const output = await format('# foo\n# @format\nbar    baz\n', options);

	expect(output).toBe('# foo\n#\n# @format\nbar baz\n');
	await expect(format(output, options)).resolves.toBe(output);

	await expect(
		format(output.replace('bar baz', 'bar    baz'), options)
	).resolves.toBe(output);
});

test('supports `shellWrapComments`', async () => {
	const input = '# foo bar baz qux\n# quux\n';

	const expectedOutput = await format(input, {
		parser: 'sh',
		plugins: [pluginSh],
		printWidth: 12,
	});

	await expect(
		format(input, {
			parser: 'sh',
			plugins: [pluginShellComments],
			printWidth: 12,
			shellWrapComments: false,
		})
	).resolves.toBe(expectedOutput);
});
