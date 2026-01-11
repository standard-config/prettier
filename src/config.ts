import type { Config } from 'prettier';
import * as pluginOxidation from '@prettier/plugin-oxc';
import * as pluginPackageJSON from 'prettier-plugin-packagejson';
import * as pluginSortJSON from 'prettier-plugin-sort-json';
import prioritizeKeys from './prioritize-keys/index.ts';

const config = {
	bracketSpacing: true,
	plugins: [pluginOxidation, pluginPackageJSON, pluginSortJSON],
	printWidth: 80,
	quoteProps: 'consistent',
	singleQuote: true,
	tabWidth: 4,
	trailingComma: 'es5',
	useTabs: true,
	overrides: [
		{
			files: ['*.css', '*.scss'],
			options: {
				printWidth: 100,
				singleQuote: false,
			},
		},
		{
			files: ['*.html'],
			options: {
				printWidth: 100,
			},
		},
		{
			files: ['*.js', '*.jsx', '*.cjs', '*.mjs'],
			options: {
				parser: 'oxc',
			},
		},
		{
			files: ['*.json', '*.jsonc'],
			options: {
				jsonRecursiveSort: true,
				jsonSortOrder: prioritizeKeys('$schema'),
			},
		},
		{
			files: ['*.ts', '*.tsx', '*.cts', '*.mts'],
			options: {
				parser: 'oxc-ts',
			},
		},
		{
			files: ['*.yaml', '*.yml'],
			options: {
				tabWidth: 2,
				useTabs: false,
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

export default config;
