import type {
	IndentationOptions,
	ShellIndentationOptions,
	StandardConfig,
	StandardConfigOverrides,
} from '../types/index.d.ts';
import clone from '../clone/index.ts';
import {
	GLOB_SET_CSS,
	GLOB_SET_GRAPHQL,
	GLOB_SET_HTML,
	GLOB_SET_JAVASCRIPT,
	GLOB_SET_JAVASCRIPT_FLOW,
	GLOB_SET_JSON,
	GLOB_SET_JSON5,
	GLOB_SET_MARKDOWN,
	GLOB_SET_MDX,
	GLOB_SET_SHELL_PROPERTIES,
	GLOB_SET_TYPESCRIPT,
	GLOB_SET_VUE,
	GLOB_SET_YAML,
} from '../constants/index.ts';
import createGlobSet from '../create-glob-set/index.ts';

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
			'prettier-plugin-expand-json',
			'prettier-plugin-markdown-html',
			'prettier-plugin-sh',
			'prettier-plugin-yaml',
		],
		bracketSpacing: true,
		printWidth: 80,
		quoteProps: 'consistent',
		simplify: true,
		singleQuote: true,
		tabWidth: shellTabWidth,
		trailingComma: 'es5',
		useTabs: shellUseTabs,
		overrides: [
			...getFileTypeOverrides({ tabWidth, useTabs }),
			...getFileNameOverrides(),
		],
	});
}

function getFileTypeOverrides(
	baseDefaults: IndentationOptions = {}
): StandardConfigOverrides {
	return [
		{
			files: GLOB_SET_CSS,
			options: {
				...baseDefaults,
				printWidth: 100,
				singleQuote: false,
			},
		},
		{
			files: GLOB_SET_GRAPHQL,
			options: {
				...baseDefaults,
			},
		},
		{
			files: GLOB_SET_HTML,
			options: {
				...baseDefaults,
				printWidth: 100,
			},
		},
		{
			files: GLOB_SET_JAVASCRIPT,
			options: {
				...baseDefaults,
				parser: 'oxc',
			},
		},
		{
			files: GLOB_SET_JAVASCRIPT_FLOW,
			options: {
				...baseDefaults,
			},
		},
		{
			files: GLOB_SET_JSON,
			options: {
				...baseDefaults,
			},
		},
		{
			files: GLOB_SET_JSON,
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
		{
			files: GLOB_SET_JSON5,
			options: {
				...baseDefaults,
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
			files: createGlobSet(GLOB_SET_MARKDOWN, GLOB_SET_MDX),
			options: {
				...baseDefaults,
				proseWrap: 'never',
				simplify: false,
				useTabs: false,
			},
		},
		{
			files: GLOB_SET_MARKDOWN,
			options: {
				htmlFragmentPrintWidth: Number.POSITIVE_INFINITY,
				htmlFragmentSingleAttributePerLine: true,
			},
		},
		{
			files: createGlobSet(GLOB_SET_SHELL_PROPERTIES, '.flaskenv'),
			options: {
				simplify: false,
			},
		},
		{
			files: GLOB_SET_TYPESCRIPT,
			options: {
				...baseDefaults,
				parser: 'oxc-ts',
			},
		},
		{
			files: GLOB_SET_VUE,
			options: {
				...baseDefaults,
			},
		},
		{
			files: GLOB_SET_YAML,
			options: {
				useTabs: false,
				yamlCollectionStyle: 'block',
			},
		},
	];
}

function getFileNameOverrides(): StandardConfigOverrides {
	return [
		{
			files: [
				'.oxfmtrc.json',
				'.oxfmtrc.jsonc',
				'.oxfmtrc.*.json',
				'.oxfmtrc.*.jsonc',
			],
			options: {
				jsonSortOrder: [
					/* prettier-ignore */
					'$schema',
					'*',
					'overrides',
				],
			},
		},
		/**
		 * All `.oxlintrc.json` fields defined by the Oxlint documentation
		 * are sorted, including nested fields.
		 */
		{
			files: [
				'.oxlintrc.json',
				'.oxlintrc.jsonc',
				'.oxlintrc.*.json',
				'.oxlintrc.*.jsonc',
			],
			options: {
				jsonSortOrder: [
					'$schema',
					'files',
					'excludeFiles',
					'extends',
					'ignorePatterns',
					'options',
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
		 * All `block.json` fields defined by the WordPress.org documentation
		 * are sorted, including nested fields.
		 */
		{
			files: [
				/* prettier-ignore */
				'block.json',
			],
			options: {
				jsonSortOrder: [
					'$schema',
					'apiVersion',
					'name',
					'category',
					'version',
					'title',
					'description',
					'icon',
					'keywords',
					'__experimental',
					'textdomain',
					'parent',
					'ancestor',
					'allowedBlocks',
					'attributes',
					'providesContext',
					'usesContext',
					'supports',
					'selectors',
					'styles',
					'example',
					'variations',
					'blockHooks',
					'style',
					'viewStyle',
					'script',
					'viewScript',
					'viewScriptModule',
					'editorStyle',
					'editorScript',
					'render',
					'*',
					'default',
				],
			},
		},
		/**
		 * All `package.json` fields defined in the `npm@12` specification
		 * are sorted, along with additional commonly used fields.
		 */
		{
			files: ['package.json'],
			options: {
				plugins: [
					/* prettier-ignore */
					'prettier-plugin-pkg',
					'prettier-plugin-expand-json',
				],
				packageSortOrder: [
					'$schema',
					'name',
					'version',
					'private',
					'description',
					'license',
					'contentPolicy',
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
					'dependenciesMeta',
					'bundleDependencies',
					'bundledDependencies',
					'peerDependencies',
					'peerDependenciesMeta',
					'optionalDependencies',
					'devDependencies',
					'overrides',
					'packageExtensions',
					'patchedDependencies',
					'allowScripts',
					'config',
					'publishConfig',
					'scripts',
				],
			},
		},
		/**
		 * All `skills.sh.json` fields supported by `skills` are sorted,
		 * including nested grouping fields.
		 */
		{
			files: ['skills.sh.json'],
			options: {
				jsonSortOrder: [
					'$schema',
					'title',
					'description',
					'skills',
					'notGrouped',
					'groupings',
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
			files: [
				/* prettier-ignore */
				'**/.vscode/mcp.json',
			],
			options: {
				jsonSortOrder: [
					/* prettier-ignore */
					'$schema',
					'command',
					'args',
				],
			},
		},
		{
			files: [
				/* prettier-ignore */
				'**/.vscode/sessions.json',
			],
			options: {
				jsonSortOrder: [
					/* prettier-ignore */
					'$schema',
					'name',
					'commands',
					'active',
				],
			},
		},
		{
			files: [
				/* prettier-ignore */
				'**/.zed/settings.json',
				'**/zed/settings.json',
			],
			options: {
				jsonSortOrder: [
					'$schema',
					'default',
					'command',
					'args',
					'*',
					'agent',
					'case_sensitive',
				],
			},
		},
		{
			files: [
				/* prettier-ignore */
				'**/.zed/keymap.json',
				'**/zed/keymap.json',
			],
			options: {
				jsonSortOrder: [
					/* prettier-ignore */
					'$schema',
					'context',
					'bindings',
				],
			},
		},
	];
}
