import type { Options as PrettierOptions } from 'prettier';

export type CommentBlockOptions = {
	/**
	 * Spaces and tabs before each comment line.
	 */
	indentation: string;
	/**
	 * Whether to join consecutive lines into paragraphs and list items.
	 */
	joinLines: boolean;
	printWidth: number;
	syntax: CommentSyntax;
	tabWidth: number;
};

export type CommentSyntax = {
	/**
	 * Characters that start each comment line, such as `#` or `//`.
	 * Repetitions of the last character are also treated as part of the marker
	 * when parsing.
	 */
	marker: string;
	/**
	 * Returns whether a line keeps its whole block as written, such as a line
	 * that can hold license text.
	 */
	isBlockKept: (line: string) => boolean;
	/**
	 * Returns whether the text after the marker is a directive, which stays as
	 * written.
	 */
	isDirective: (text: string) => boolean;
	/**
	 * Returns whether a word would read as markup at the start of a line. The
	 * formatter checks list markers separately.
	 */
	isUnsafeLineStart: (word: string) => boolean;
};

export type EditorConfigProperties = Record<string, boolean | number | string>;

export type EditorConfigSection = [
	label: string,
	patterns: ReadonlyArray<string>,
	properties: EditorConfigProperties,
];

export type PrettierPlugin = NonNullable<PrettierOptions['plugins']>[number];

export type PrettierPlugins = PrettierPlugin[];
