import type { Parser, ParserOptions, Plugin } from 'prettier';

export type CommentEdit = {
	/**
	 * Directives that the edit turns into block comments.
	 */
	conversions: Conversion[];
	/**
	 * Index of the first line of a comment that the edit moves to another line,
	 * in the edit’s text.
	 */
	movedLine?: number;
} & TextEdit;

export type Conversion = {
	/**
	 * Whether the directive follows code on its line.
	 */
	isTrailing: boolean;
	/**
	 * Index of the converted line in the edit’s text.
	 */
	line: number;
	/**
	 * Offset of the original comment.
	 */
	start: number;
};

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
	 * Wrap comments to the preferred line length. `full-line` skips trailing
	 * comments. `all` moves trailing line comments onto their own lines before
	 * wrapping. `none` leaves comments as written.
	 *
	 * @default 'all'
	 */
	tsCommentWrap?: 'all' | 'full-line' | 'none' | undefined;
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
	/**
	 * Original range whose text and cursor positions move with this edit.
	 */
	source?: TextRange;
	start: number;
	text: string;
};

export type TextRange = {
	end: number;
	start: number;
};

declare module 'prettier' {
	interface Options extends PluginOptions {}
}
