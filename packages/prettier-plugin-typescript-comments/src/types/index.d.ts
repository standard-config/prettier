import type { Parser, ParserOptions, Plugin } from 'prettier';

export type ParserDelegation = {
	hook: ParserHookName;
	parserName: ParserName;
	resolveNext: () => Promise<ResolvedPriorParser | undefined>;
};

export type ParserHookName = 'parse' | 'preprocess';

export type ParserInitializer = () => Parser | Promise<Parser>;

export type ParserName = 'babel' | 'oxc' | 'oxc-ts' | 'typescript';

export type ParseWithCompatibility = (
	this: Parser,
	text: string,
	options: ParserOptions,
	optionsForCompatibility: ParserOptions
) => unknown;

export interface PluginOptions {
	/**
	 * Control wrapping for comments. `full-line` reflows only the comments that
	 * occupy their own lines: `//` comments, single-line doc comments, and
	 * multi-line block comments with a `*` gutter. It also turns `//` directives
	 * into block comments where tools read both. `none` leaves all comments as
	 * written. Reflowing uses the print width as a target and removes redundant
	 * `/` characters and empty comment lines.
	 * @default 'full-line'
	 */
	tsCommentWrap?: 'full-line' | 'none' | undefined;
}

export type PluginWithParsers = Omit<Plugin, 'parsers'> & {
	parsers: Record<string, Parser | ParserInitializer>;
};

export type ResolvedPriorParser = {
	delegation?: ParserDelegation;
	entryOptions?: Pick<ParserOptions, 'locEnd' | 'locStart' | 'plugins'>;
	lifecycleState: Partial<
		Pick<ParserOptions, 'locEnd' | 'locStart' | 'plugins'>
	>;
	parser: Parser;
	plugins: ParserOptions['plugins'];
};

export type TextEdit = {
	end: number;
	start: number;
	text: string;
};

declare module 'prettier' {
	interface Options extends PluginOptions {}
}
