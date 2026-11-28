import type { Options as PrettierOptions } from 'prettier';

export type CommentBlockOptions = {
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
	 * Returns whether a marker must stay on its source line. The line includes
	 * its comment marker and can still start or continue a list item.
	 */
	hasLineSensitiveMarker?: (line: string) => boolean;
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
	 * Returns whether a line stays as written without extra blank lines.
	 * `lines` keeps the original markers. In `texts`, markers are stripped and
	 * fenced lines are empty.
	 */
	isLineKept: (
		texts: ReadonlyArray<string>,
		index: number,
		lines: ReadonlyArray<string>
	) => boolean;
	/**
	 * Returns whether a word could start markup or a directive on a new line.
	 * The formatter checks list and fence markers separately. `isLastWord` is
	 * true when only whitespace follows the word.
	 */
	isUnsafeLineStart: (word: string, isLastWord: boolean) => boolean;
	/**
	 * Returns whether starting a paragraph with this line would change its
	 * meaning. The line can join the paragraph above but must stay as written
	 * on its own.
	 */
	isUnsafeParagraphStart: (line: string) => boolean;
	/**
	 * Returns whether the rendered lines change the meaning of the paragraph or
	 * list item. If so, the formatter keeps its original lines.
	 */
	isUnsafeReflow?: (lines: ReadonlyArray<string>) => boolean;
};

export type EditorConfigProperties = Record<string, boolean | number | string>;

export type EditorConfigSection = [
	label: string,
	patterns: ReadonlyArray<string>,
	properties: EditorConfigProperties,
];

export type PrettierPlugin = NonNullable<PrettierOptions['plugins']>[number];

export type PrettierPlugins = PrettierPlugin[];
