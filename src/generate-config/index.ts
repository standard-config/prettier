import type {
	IndentationOptions,
	ShellIndentationOptions,
	StandardConfig,
	StandardConfigOverrides,
} from '../types/index.d.ts';
import clone from '../clone/index.ts';

/**
 * Generate the base Standard Config.
 *
 * Shell scripts can’t be reliably identified by name alone—they’re recognized
 * by the shebang, not the extension. As a result, shell formatting options
 * (two-space indentation) must be defined as the global defaults.
 *
 * This requires overriding those options for other file types individually
 * with what we consider the actual defaults (`baseDefaults`). `generateConfig`
 * is a factory that encapsulates this logic and returns the final config.
 */
export default function generateConfig(
	baseDefaults: IndentationOptions = {},
	shellDefaults: ShellIndentationOptions = {}
): StandardConfig {
	const { tabWidth = 4, useTabs = true } = baseDefaults;
	const { shellTabWidth = 2, shellUseTabs = false } = shellDefaults;

	return clone({
		plugins: [
			'@prettier/plugin-oxc',
			'@prettier/plugin-xml',
			'prettier-plugin-expand-json',
			'prettier-plugin-markdown-html',
			'prettier-plugin-sh',
			'prettier-plugin-yaml',
		],
		bracketSpacing: true,
		printWidth: 80,
		quoteProps: 'consistent',
		singleQuote: true,
		tabWidth: shellTabWidth,
		trailingComma: 'es5',
		useTabs: shellUseTabs,
		overrides: [
			...getFileTypeOverrides(
				{ tabWidth, useTabs },
				{ tabWidth: shellTabWidth, useTabs: shellUseTabs }
			),
			...getFileNameOverrides(),
		],
	});
}

function getFileTypeOverrides(
	baseDefaults: IndentationOptions = {},
	shellDefaults: IndentationOptions = {}
): StandardConfigOverrides {
	return [
		{
			files: ['*.css', '*.scss'],
			options: {
				...baseDefaults,
				printWidth: 100,
				singleQuote: false,
			},
		},
		{
			files: ['*.graphql', '*.graphqls', '*.gql'],
			options: {
				...baseDefaults,
			},
		},
		{
			files: ['*.html', '*.htm'],
			options: {
				...baseDefaults,
				printWidth: 100,
			},
		},
		{
			files: ['*.js', '*.jsx', '*.cjs', '*.mjs'],
			options: {
				...baseDefaults,
				parser: 'oxc',
			},
		},
		{
			files: ['*.json', '*.jsonc', '*.json5'],
			options: {
				...baseDefaults,
			},
		},
		{
			files: ['*.json', '*.jsonc', '*.json5'],
			excludeFiles: ['package.json'],
			options: {
				plugins: [
					'prettier-plugin-sort-json',
					'prettier-plugin-expand-json',
				],
				jsonRecursiveSort: true,
				jsonSortOrder: ['$schema'],
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
				...baseDefaults,
				useTabs: false,
			},
		},
		{
			files: ['*.md'],
			options: {
				htmlFragmentPrintWidth: Number.POSITIVE_INFINITY,
				htmlFragmentSingleAttributePerLine: true,
			},
		},
		{
			files: ['*.sh'],
			options: {
				...shellDefaults,
			},
		},
		{
			files: ['*.ts', '*.tsx', '*.cts', '*.mts'],
			options: {
				...baseDefaults,
				parser: 'oxc-ts',
			},
		},
		{
			files: ['*.xml', '*.plist', '*.svg'],
			options: {
				...baseDefaults,
				parser: 'xml',
				printWidth: 80,
				singleAttributePerLine: true,
				xmlQuoteAttributes: 'double',
				xmlWhitespaceSensitivity: 'ignore',
			},
		},
		{
			files: ['*.yaml', '*.yml'],
			options: {
				yamlCollectionStyle: 'block',
				useTabs: false,
			},
		},
	];
}

function getFileNameOverrides(): StandardConfigOverrides {
	return [
		/**
		 * All `.oxlintrc.json` fields defined by the Oxlint documentation
		 * are sorted, including nested fields.
		 */
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
				jsonSortOrder: [
					'$schema',
					'files',
					'extends',
					'ignorePatterns',
					'plugins',
					'jsPlugins',
					'categories',
					'env',
					'globals',
					'settings',
					'rules',
					'overrides',
				],
			},
		},
		/**
		 * By default, Prettier uses a different parser for `package.json`
		 * files, which causes most JSON plugins to skip them entirely.
		 * This override ensures `package.json` is treated (and sorted)
		 * like any other `*.json` file.
		 *
		 * All `package.json` fields defined in the `npm@11` specification
		 * are sorted, along with additional commonly used fields.
		 */
		{
			files: ['package.json'],
			options: {
				plugins: [
					'prettier-plugin-packagejson',
					'prettier-plugin-expand-json',
				],
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
		/**
		 * All `tsconfig.json` fields defined by the TypeScript documentation
		 * are sorted, including nested fields.
		 */
		{
			files: [
				'tsconfig.json',
				'tsconfig.*.json',
				'jsconfig.json',
				'jsconfig.*.json',
			],
			options: {
				jsonSortOrder: [
					'$schema',
					'extends',
					'enable',
					'references',
					'compilerOptions',
					'typeAcquisition',
					'files',
					'include',
					'exclude',
					'watchOptions',
					'watchDirectory',
					'watchFile',
					'fallbackPolling',
					'synchronousWatchDirectory',
					'compileOnSave',
				],
			},
		},
		{
			files: ['.vscode/mcp.json'],
			options: {
				jsonSortOrder: ['$schema', 'command'],
			},
		},
		{
			files: ['.vscode/sessions.json'],
			options: {
				jsonSortOrder: ['$schema', 'name', 'commands', 'active'],
			},
		},
	];
}
