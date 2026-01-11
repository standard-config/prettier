import type { Config, Options } from 'prettier';
import * as pluginOxidation from '@prettier/plugin-oxc';
import * as pluginPackageJSON from 'prettier-plugin-packagejson';
import * as pluginSortJSON from 'prettier-plugin-sort-json';
import * as pluginShell from 'prettier-plugin-sh';
import prioritizeKeys from './prioritize-keys/index.ts';

/**
 * Shell files can’t be reliably identified by name alone—they’re recognized by
 * the shebang, not the extension. As a result, shell formatting options
 * (two-space indentation) must be defined as the global defaults.
 *
 * This requires overriding those options for other file types individually
 * with what we consider the actual defaults. This object defines them.
 */
export const DEFAULT_OPTIONS = {
	tabWidth: 4,
	useTabs: true,
} as const satisfies Options;

export const DEFAULT_CONFIG = {
	plugins: [pluginOxidation, pluginPackageJSON, pluginShell, pluginSortJSON],
	bracketSpacing: true,
	printWidth: 80,
	quoteProps: 'consistent',
	singleQuote: true,
	tabWidth: 2,
	trailingComma: 'es5',
	useTabs: false,
	overrides: [
		{
			files: ['*.css', '*.scss'],
			options: {
				...DEFAULT_OPTIONS,
				printWidth: 100,
				singleQuote: false,
			},
		},
		/**
		 * Fish file formatting follows the output of `fish_indent`, which
		 * defaults to four-space indentation.
		 */
		{
			files: ['*.fish'],
			options: {
				tabWidth: 4,
			},
		},
		{
			files: ['*.graphql', '*.graphqls', '*.gql'],
			options: {
				...DEFAULT_OPTIONS,
			},
		},
		{
			files: ['*.html', '*.htm'],
			options: {
				...DEFAULT_OPTIONS,
				printWidth: 100,
			},
		},
		{
			files: ['*.js', '*.jsx', '*.cjs', '*.mjs'],
			options: {
				...DEFAULT_OPTIONS,
				parser: 'oxc',
			},
		},
		{
			files: ['*.json', '*.jsonc', '*.json5'],
			options: {
				...DEFAULT_OPTIONS,
				jsonRecursiveSort: true,
				jsonSortOrder: prioritizeKeys('$schema'),
			},
		},
		{
			files: ['*.md', '*.mdx'],
			options: {
				...DEFAULT_OPTIONS,
			},
		},
		{
			files: ['*.ts', '*.tsx', '*.cts', '*.mts'],
			options: {
				...DEFAULT_OPTIONS,
				parser: 'oxc-ts',
			},
		},
		{
			files: [
				'oxlintrc.json',
				'oxlintrc.jsonc',
				'oxlintrc.*.json',
				'oxlintrc.*.jsonc',
				'.oxlintrc.json',
				'.oxlintrc.jsonc',
				'.oxlintrc.*.json',
				'.oxlintrc.*.jsonc',
			],
			options: {
				jsonSortOrder: prioritizeKeys(
					'$schema',
					'files',
					'extends',
					'plugins',
					'categories',
					'env',
					'settings',
					'rules',
					'overrides'
				),
			},
		},
		{
			files: ['package.json'],
			options: {
				packageSortOrder: [
					'name',
					'private',
					'version',
					'description',
					'license',
					'author',
					'repository',
					'keywords',
					'directories',
					'files',
					'type',
					'sideEffects',
					'main',
					'exports',
					'types',
					'bin',
					'imports',
					'engines',
					'packageManager',
					'dependencies',
					'peerDependencies',
					'peerDependenciesMeta',
					'devDependencies',
					'scripts',
				],
			},
		},
		{
			files: [
				'tsconfig.json',
				'tsconfig.*.json',
				'jsconfig.json',
				'jsconfig.*.json',
			],
			options: {
				jsonSortOrder: prioritizeKeys(
					'extends',
					'compilerOptions',
					'files',
					'include',
					'exclude'
				),
			},
		},
	],
} as const satisfies Config;
