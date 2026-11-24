import type { Options as PrettierOptions } from 'prettier';

export type CommentBlockOptions = {
	/**
	 * Spaces and tabs before each comment line.
	 */
	indentation: string;
	printWidth: number;
	syntax: CommentSyntax;
	tabWidth: number;
};

export type CommentSyntax = {
	/**
	 * Characters that start each comment line, such as `#` or `//`. Parsing
	 * treats repetitions of the last character as part of the marker.
	 */
	marker: string;
	/**
	 * Returns whether a line keeps its whole block as written, such as a line
	 * that can hold license text.
	 */
	isBlockKept: (line: string) => boolean;
	/**
	 * Returns whether the marker is followed by a directive to keep as written.
	 */
	isDirective: (text: string) => boolean;
	/**
	 * Returns whether a line stays as written without the blank lines added
	 * around directives. Each entry holds the text after its comment marker,
	 * with empty strings for lines inside code fences.
	 */
	isLineKept: (texts: ReadonlyArray<string>, index: number) => boolean;
	/**
	 * Returns whether a word would read as markup at the start of a line. The
	 * formatter checks list markers and code fence markers separately.
	 */
	isUnsafeLineStart: (word: string) => boolean;
	/**
	 * Returns whether starting a paragraph with this line would change its
	 * meaning. The line can join the paragraph above but must stay as written
	 * on its own.
	 */
	isUnsafeParagraphStart: (line: string) => boolean;
};

export type EditorConfigProperties = Record<string, boolean | number | string>;

export type EditorConfigSection = [
	label: string,
	patterns: ReadonlyArray<string>,
	properties: EditorConfigProperties,
];

export type PrettierPlugin = NonNullable<PrettierOptions['plugins']>[number];

export type PrettierPlugins = PrettierPlugin[];
