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
	plugins: [pluginOxidation, pluginShell],
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
				plugins: [pluginSortJSON],
				jsonRecursiveSort: true,
				jsonSortOrder: prioritizeKeys('$schema'),
			},
		},
		/**
		 * Tab-based indentation becomes inconvenient when rendered outside the
		 * context of a code editor. In documentation, tabs in code blocks
		 * require special handling that very few renderers support.
		 *
		 * At the time of writing, GitHub renders tabs correctly on the web, but
		 * not in its mobile app. `npm`, often the point of discovery for
		 * packages, does not provide any special handling for tabs either.
		 *
		 * To maximize the readability of code blocks in documentation, spaces
		 * are the right compromise.
		 */
		{
			files: ['*.md', '*.mdx'],
			options: {
				...DEFAULT_OPTIONS,
				useTabs: false,
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
			files: ['*.xml', '*.plist', '*.svg'],
			options: {
				...DEFAULT_OPTIONS,
				parser: 'html',
				printWidth: 80,
				singleAttributePerLine: true,
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
				plugins: [pluginPackageJSON, pluginSortJSON],
				packageSortOrder: [
					'$schema',
					'name',
					'version',
					'private',
					'description',
					'license',
					'author',
					'contributors',
					'funding',
					'homepage',
					'repository',
					'bugs',
					'keywords',
					'workspaces',
					'directories',
					'files',
					'type',
					'browser',
					'sideEffects',
					'main',
					'module',
					'exports',
					'types',
					'typesVersions',
					'bin',
					'man',
					'imports',
					'engines',
					'os',
					'cpu',
					'libc',
					'gypfile',
					'packageManager',
					'devEngines',
					'dependencies',
					'bundleDependencies',
					'peerDependencies',
					'peerDependenciesMeta',
					'optionalDependencies',
					'devDependencies',
					'overrides',
					'pnpm',
					'config',
					'publishConfig',
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
					'$schema',
					'extends',
					'references',
					'compilerOptions',
					'typeAcquisition',
					'files',
					'include',
					'exclude',
					'watchOptions',
					'compileOnSave'
				),
			},
		},
	],
} as const satisfies Config;
