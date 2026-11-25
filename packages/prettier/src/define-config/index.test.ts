import type { Config as PrettierConfig } from 'prettier';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { getFileInfo, getSupportInfo } from 'prettier';
import * as pluginShell from 'prettier-plugin-shell';
import * as pluginTypeScript from 'prettier-plugin-typescript';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import defineConfig from './index.ts';

test('returns a Prettier config', () => {
	expectTypeOf(defineConfig).returns.toEqualTypeOf<PrettierConfig>();
});

test('merges custom config with the base config', () => {
	const config = {
		singleQuote: false,
		useTabs: false,
		overrides: [
			{
				files: ['*.html'],
				options: {
					printWidth: 160,
				},
			},
		],
	} as const satisfies PrettierConfig;

	const result = defineConfig(config);

	expect(result).toHaveProperty('singleQuote', false);
	expect(result).toHaveProperty('useTabs', false);

	expect(result).toHaveProperty('overrides', expect.any(Array));
	expect(result.overrides).toContainEqual(config.overrides[0]);

	expect(result).toHaveProperty('plugins', expect.any(Array));
	expect(result.plugins).toContain(pluginShell);
	expect(result.plugins).toContain(pluginTypeScript);
});

test('resolves every plugin name in the base config', () => {
	const { overrides = [], plugins = [] } = defineConfig();

	const names = [
		...plugins,
		...overrides.flatMap((override) => override.options?.plugins ?? []),
	].filter((plugin) => typeof plugin === 'string' && !isAbsolute(plugin));

	expect(names).toStrictEqual([]);
});

test.each([
	{ filepath: 'foo.cjs', parser: 'oxc' },
	{ filepath: 'foo.js', parser: 'oxc' },
	{ filepath: 'foo.jsx', parser: 'oxc' },
	{ filepath: 'foo.mjs', parser: 'oxc' },
	{ filepath: 'Jakefile', parser: 'oxc' },
	{ filepath: 'foo.cts', parser: 'oxc-ts' },
	{ filepath: 'foo.d.ts', parser: 'oxc-ts' },
	{ filepath: 'foo.mts', parser: 'oxc-ts' },
	{ filepath: 'foo.ts', parser: 'oxc-ts' },
	{ filepath: 'foo.tsx', parser: 'oxc-ts' },
	{ filepath: 'foo.js.flow', parser: 'flow' },
	{ filepath: 'foo.json', parser: 'json' },
])(
	'infers the `$parser` parser for `$filepath` from the plugins alone',
	async ({ filepath, parser }) => {
		const { plugins } = defineConfig();

		const { inferredParser } = await getFileInfo(filepath, {
			plugins,
			resolveConfig: false,
		});

		expect(inferredParser).toBe(parser);
	}
);

test.each([
	{ interpreter: 'node', parser: 'oxc' },
	{ interpreter: 'ts-node', parser: 'oxc-ts' },
])(
	'infers the `$parser` parser for an extensionless script with a `$interpreter` shebang from the plugins alone',
	async ({ interpreter, parser }) => {
		using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
		const filepath = join(directory.path, 'foo');
		writeFileSync(filepath, `#!/usr/bin/env ${interpreter}\nfoo();\n`);
		const { plugins } = defineConfig();

		const { inferredParser } = await getFileInfo(filepath, {
			plugins,
			resolveConfig: false,
		});

		expect(inferredParser).toBe(parser);
	}
);

test('supports custom config options', () => {
	const config = {
		shCommentWrap: 'none',
		shTabWidth: 4,
		shUseTabs: true,
		tsCommentWrap: 'none',
	} as const satisfies PrettierConfig;

	const result = defineConfig(config);

	expect(result).toHaveProperty('shCommentWrap', 'none');
	expect(result).toHaveProperty('shTabWidth', 4);
	expect(result).toHaveProperty('shUseTabs', true);
	expect(result).toHaveProperty('tsCommentWrap', 'none');
});

test('supports custom config options where overrides replace `plugins`', async () => {
	const { overrides = [] } = defineConfig();

	const pluginLists = overrides.flatMap((override) =>
		override.options?.plugins ? [override.options.plugins] : []
	);

	expect(pluginLists).not.toHaveLength(0);

	for (const plugins of pluginLists) {
		const { options } = await getSupportInfo({ plugins });

		expect(options.map((option) => option.name)).toStrictEqual(
			expect.arrayContaining([
				'shCommentWrap',
				'shTabWidth',
				'shUseTabs',
				'tsCommentWrap',
			])
		);
	}
});
