import type { Options as PrettierOptions } from 'prettier';

export type PrettierPlugin = NonNullable<PrettierOptions['plugins']>[number];

export type PrettierPlugins = PrettierPlugin[];

type DefaultOptions = {
	/**
	 * Print spaces between brackets in object literals.
	 * @default true
	 */
	bracketSpacing?: PrettierOptions['bracketSpacing'];
	/**
	 * Define a custom sort order for JSON files.
	 */
	jsonSortOrder?: string | string[] | undefined;
	/**
	 * Maximum line length before wrapping.
	 * @default 80
	 */
	printWidth?: PrettierOptions['printWidth'];
	/**
	 * Change when properties in objects are quoted.
	 * @default 'consistent'
	 */
	quoteProps?: PrettierOptions['quoteProps'];
	/**
	 * Indentation width for shell scripts.
	 * @default 2
	 */
	shellTabWidth?: PrettierOptions['tabWidth'];
	/**
	 * Use tabs instead of spaces for shell scripts.
	 * @default false
	 */
	shellUseTabs?: PrettierOptions['useTabs'];
	/**
	 * Use single quotes instead of double quotes.
	 * @default true
	 */
	singleQuote?: PrettierOptions['singleQuote'];
	/**
	 * Indentation width for all non-shell files.
	 * @default 4
	 */
	tabWidth?: PrettierOptions['tabWidth'];
	/**
	 * Print trailing commas where valid in ES5.
	 * @default 'es5'
	 */
	trailingComma?: PrettierOptions['trailingComma'];
	/**
	 * Use tabs instead of spaces for all non-shell files.
	 * @default true
	 */
	useTabs?: PrettierOptions['useTabs'];
};

export type StandardOptions = {
	// Prettier’s `Options` is a mapped type, so overlapping keys must
	// be explicitly omitted before merging with `DefaultOptions`
	[K in keyof PrettierOptions as K extends keyof DefaultOptions
		? never
		: K]: PrettierOptions[K];
} & DefaultOptions;

export type IndentationOptions = Pick<StandardOptions, 'tabWidth' | 'useTabs'>;

export type ShellIndentationOptions = Pick<
	StandardOptions,
	'shellTabWidth' | 'shellUseTabs'
>;

export type StandardConfigOverride = {
	excludeFiles?: string[];
	files: string[];
	options: StandardOptions;
};

export type StandardConfigOverrides = StandardConfigOverride[];

export type StandardConfigPluginOverrides = Record<
	string,
	PrettierPlugin | undefined
>;

export type StandardConfig = StandardOptions & {
	/**
	 * File-based config overrides.
	 */
	overrides?: StandardConfigOverrides;
	/**
	 * @deprecated Intended for development use and not covered by semver.
	 */
	pluginOverrides?: StandardConfigPluginOverrides;
};
