import { util } from 'prettier';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	PRAGMA_PATTERN,
} from '../constants/index.ts';

export type CommentBlockOptions = {
	/**
	 * Spaces and tabs before each comment line.
	 */
	indentation: string;
	/**
	 * Whether the block is part of the comments that start the file, where
	 * Prettier reads pragmas.
	 */
	isLeading: boolean;
	/**
	 * Whether to join consecutive lines into paragraphs and list items.
	 */
	joinLines: boolean;
	printWidth: number;
	tabWidth: number;
};

type BlockNode =
	| { continuation: string; prefix: string; texts: string[]; type: 'item' }
	| { isDirective: boolean; line: string; type: 'verbatim' }
	| { texts: string[]; type: 'paragraph' }
	| { type: 'empty' };

const EMPTY_NODE: BlockNode = { type: 'empty' };
const LIST_MARKER_PATTERN = /^([*+-]|\d+[).])(?:[ \t]+|$)/;
const UNSAFE_LINE_START_PATTERN =
	/^(?:#|-\*-|dotenv-linter:|shellcheck|SPDX-|vi:|vim:|(?:[*+-]|\d+[).]|bats|endregion|prettier-ignore|region)$)/;

/**
 * Formats the lines of one comment block, given without their indentation.
 */
export default function formatCommentBlock(
	lines: ReadonlyArray<string>,
	options: CommentBlockOptions
): string[] {
	// Keep blocks with a `#!` line as written in case they hold license text,
	// as with JavaScript’s `/*! */` comments
	if (
		lines.some(
			(line) => line.startsWith('#!') || IGNORE_MARKER_PATTERN.test(line)
		)
	) {
		return [...lines];
	}

	const nodes = separateNodes(parseNodes(lines, options));

	return nodes.flatMap((node) => printNode(node, options));
}

/**
 * Reads comment lines into paragraphs, list items, and lines kept as written.
 */
function parseNodes(
	lines: ReadonlyArray<string>,
	{ isLeading, joinLines }: CommentBlockOptions
): BlockNode[] {
	const nodes: BlockNode[] = [];
	let openNode: Extract<BlockNode, { texts: string[] }> | undefined;

	for (const line of lines) {
		// Data files can hold commented-out entries, one per line
		if (!joinLines) {
			openNode = undefined;
		}

		const rest = line.replace(/^#+/, '');
		const [indentation] = /^[ \t]*/.exec(rest)!;
		const text = rest.slice(indentation.length);

		if (text === '') {
			nodes.push(EMPTY_NODE);
			openNode = undefined;
			continue;
		}

		const marker = LIST_MARKER_PATTERN.exec(text);

		if (marker) {
			const itemIndentation = indentation || ' ';
			openNode = {
				continuation: `#${itemIndentation}${' '.repeat(marker[1]!.length + 1)}`,
				prefix: `#${itemIndentation}${marker[1]!} `,
				texts: [text.slice(marker[0].length)],
				type: 'item',
			};
			nodes.push(openNode);
			continue;
		}

		const isIndented = indentation.length > 1 || indentation === '\t';

		if (
			DIRECTIVE_PATTERN.test(text) ||
			(isLeading && PRAGMA_PATTERN.test(text))
		) {
			nodes.push({ isDirective: true, line, type: 'verbatim' });
			openNode = undefined;
			continue;
		}

		// Remaining lines continue an open list item regardless of indentation
		if (openNode?.type === 'item') {
			openNode.texts.push(text);
			continue;
		}

		if (isIndented) {
			nodes.push({ isDirective: false, line, type: 'verbatim' });
			openNode = undefined;
			continue;
		}

		if (openNode?.type === 'paragraph') {
			openNode.texts.push(text);
			continue;
		}

		openNode = { texts: [text], type: 'paragraph' };
		nodes.push(openNode);
	}

	return nodes;
}

/**
 * Surrounds directives with empty comment lines, then removes repeated empty
 * lines and those at either end of the block.
 */
function separateNodes(nodes: ReadonlyArray<BlockNode>): BlockNode[] {
	const separatedNodes: BlockNode[] = [];

	for (const [index, node] of nodes.entries()) {
		const previousNode = nodes[index - 1];

		if (
			previousNode &&
			isDirective(node) !== isDirective(previousNode) &&
			node.type !== 'empty' &&
			previousNode.type !== 'empty'
		) {
			separatedNodes.push(EMPTY_NODE);
		}

		if (node.type !== 'empty' || separatedNodes.at(-1)?.type !== 'empty') {
			separatedNodes.push(node);
		}
	}

	while (separatedNodes[0]?.type === 'empty') {
		separatedNodes.shift();
	}

	while (separatedNodes.at(-1)?.type === 'empty') {
		separatedNodes.pop();
	}

	// Removing every line would leave a stray blank line that the shell
	// printer collapses on the next run
	return separatedNodes.length > 0 ? separatedNodes : [EMPTY_NODE];
}

/**
 * Checks whether a node is a ShellCheck directive or a Prettier pragma.
 */
function isDirective(node: BlockNode): boolean {
	return node.type === 'verbatim' && node.isDirective;
}

/**
 * Prints a node as comment lines.
 */
function printNode(node: BlockNode, options: CommentBlockOptions): string[] {
	switch (node.type) {
		case 'empty':
			return ['#'];

		case 'item':
			return fillWords(
				splitWords(node.texts.join(' ')),
				node.prefix,
				node.continuation,
				options
			);

		case 'paragraph':
			return fillWords(
				splitWords(node.texts.join(' ')),
				'# ',
				'# ',
				options
			);

		case 'verbatim':
			return [node.line];
	}
}

/**
 * Splits text at spaces and tabs outside code spans, which stay whole.
 */
function splitWords(text: string): string[] {
	const words: string[] = [];
	let word = '';

	for (let index = 0; index < text.length; index += 1) {
		const character = text[index]!;

		if (character === '`') {
			const end = text.indexOf('`', index + 1);

			if (end !== -1) {
				word += text.slice(index, end + 1);
				index = end;
				continue;
			}
		}

		if (character === ' ' || character === '\t') {
			if (word !== '') {
				words.push(word);
				word = '';
			}

			continue;
		}

		word += character;
	}

	if (word !== '') {
		words.push(word);
	}

	return words;
}

/**
 * Fills lines greedily, keeping potential markup with the preceding word.
 */
function fillWords(
	words: ReadonlyArray<string>,
	prefix: string,
	continuation: string,
	{ indentation, isLeading, printWidth, tabWidth }: CommentBlockOptions
): string[] {
	const fits = (line: string) =>
		getLineWidth(indentation + line, tabWidth) <= printWidth;

	if (words.length === 0) {
		return [prefix.trimEnd()];
	}

	const lines: string[] = [];
	let line = prefix + words[0]!;

	for (const word of words.slice(1)) {
		const extendedLine = `${line} ${word}`;

		// Some words would read as markup at the start of a line, and a line
		// holding only a marker such as `prettier-ignore` or `bats` would also be
		// parsed as markup
		if (
			fits(extendedLine) ||
			IGNORE_MARKER_PATTERN.test(line) ||
			DIRECTIVE_PATTERN.test(line.replace(/^#[ \t]*/, '')) ||
			UNSAFE_LINE_START_PATTERN.test(word) ||
			(isLeading && PRAGMA_PATTERN.test(word))
		) {
			line = extendedLine;
		} else {
			lines.push(line);
			line = continuation + word;
		}
	}

	lines.push(line);
	return lines;
}

/**
 * Measures a line in columns, advancing each tab to the next tab stop.
 */
function getLineWidth(line: string, tabWidth: number): number {
	let width = 0;

	for (const [index, segment] of line.split('\t').entries()) {
		if (index > 0) {
			width += tabWidth - (width % tabWidth);
		}

		width += util.getStringWidth(segment);
	}

	return width;
}
