import type { PrettierPlugin } from '@standard-config/utilities/types';
import type { Options as PrettierOptions } from 'prettier';
import type {} from 'prettier-plugin-shell';
import type {} from 'prettier-plugin-typescript';

type DefaultOptions = {
	/**
	 * Print spaces between brackets in object literals.
	 *
	 * @default true
	 */
	bracketSpacing?: PrettierOptions['bracketSpacing'];
	/**
	 * Set the order of keys in JSON files. In an array, place `*` where
	 * unmatched keys should sort. Omit it to put them last.
	 */
	jsonSortOrder?: string | string[] | undefined;
	/**
	 * Specify the line length that the printer will wrap on.
	 *
	 * @default 80
	 */
	printWidth?: PrettierOptions['printWidth'];
	/**
	 * Change when properties in objects are quoted.
	 *
	 * @default 'consistent'
	 */
	quoteProps?: PrettierOptions['quoteProps'];
	/**
	 * Use single quotes instead of double quotes.
	 *
	 * @default true
	 */
	singleQuote?: PrettierOptions['singleQuote'];
	/**
	 * Specify the number of spaces per indentation level. Doesn’t affect files
	 * formatted by the shell plugin.
	 *
	 * @default 4
	 */
	tabWidth?: PrettierOptions['tabWidth'];
	/**
	 * Print trailing commas wherever possible.
	 *
	 * @default 'es5'
	 */
	trailingComma?: PrettierOptions['trailingComma'];
	/**
	 * Indent lines with tabs instead of spaces. Doesn’t affect files formatted
	 * by the shell plugin.
	 *
	 * @default true
	 */
	useTabs?: PrettierOptions['useTabs'];
};

export type StandardOptions = {
	// Prettier’s `Options` is a mapped type, so overlapping keys must be
	// explicitly omitted before merging with `DefaultOptions`
	[
		K in keyof PrettierOptions as K extends keyof DefaultOptions ? never : K
	]: PrettierOptions[K];
} & DefaultOptions;

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
