import type { Options as PrettierOptions } from 'prettier';

export interface StandardOptions extends PrettierOptions {
	/**
	 * Print spaces between brackets in object literals.
	 * @default true
	 */
	bracketSpacing?: PrettierOptions['bracketSpacing'];
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
}

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

export interface StandardConfig extends StandardOptions {
	overrides?: StandardConfigOverrides;
}
