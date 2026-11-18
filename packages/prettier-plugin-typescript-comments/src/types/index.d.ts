import type { Parser, ParserOptions, Plugin } from 'prettier';

export type CommentEdit = {
	/**
	 * Directives that the edit turns into block comments.
	 */
	conversions: Conversion[];
	/**
	 * Index of the first line of a comment that the edit moves to another
	 * line, in the edit’s text.
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
	 * Control wrapping for comments. `all` moves trailing `//` comments onto
	 * their own lines where possible, then reflows supported comments.
	 * `full-line` reflows only the comments that occupy their own lines: `//`
	 * comments, single-line doc comments, and multi-line block comments with a
	 * `*` gutter. Both convert supported `//` directives to block comments
	 * when their tools read them in that form. `none` leaves all comments as
	 * written. Reflowing uses the print width as a target and removes
	 * redundant `/` characters and empty comment lines.
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
	 * Range of the original text that the edit’s text moves here, which a
	 * cursor inside that range follows.
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
