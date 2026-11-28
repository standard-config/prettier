import type { CommentBlockOptions } from '../types/index.d.ts';
import { util } from 'prettier';

type BlockNode =
	| {
			continuation: string;
			lines: string[];
			prefix: string;
			texts: string[];
			type: 'continuation' | 'item';
	  }
	| { isDirective: boolean; line: string; type: 'verbatim' }
	| { line: string; type: 'kept' }
	| { lines: string[]; texts: string[]; type: 'paragraph'; words: string }
	| { type: 'empty' };

const EMPTY_NODE: BlockNode = { type: 'empty' };
// An opening backtick fence can’t hold a backtick after its marker
const FENCE_PATTERN = /^(?:`{3,}(?!.*`)|~{3,})/;
const LIST_MARKER_PATTERN = /^([*+-]|\d+[).])(?:[ \t]+|$)/;
const LIST_MARKERS_PATTERN = /^(?:(?:[*+-]|\d+[).])[ \t]+)+/;

/**
 * Formats the lines of one comment block, given without their indentation.
 */
export default function formatCommentBlock(
	lines: ReadonlyArray<string>,
	options: CommentBlockOptions
): string[] {
	if (lines.some((line) => options.syntax.isBlockKept(line))) {
		return [...lines];
	}

	const nodes = separateNodes(parseNodes(lines, options));

	return nodes.flatMap((node) => {
		const formatted = printNode(node, options);

		return 'lines' in node && options.syntax.isUnsafeReflow?.(formatted)
			? node.lines
			: formatted;
	});
}

/**
 * Returns the indexes of the lines that belong to code fences, including the
 * lines that open and close them.
 */
export function findFencedLines(
	lines: ReadonlyArray<string>,
	marker: string
): Set<number> {
	const markerPattern = getMarkerPattern(marker);
	const fencedLines = new Set<number>();
	let closingFencePattern: RegExp | undefined;

	for (const [index, line] of lines.entries()) {
		const text = line.replace(markerPattern, '').replace(/^[ \t]*/, '');

		if (closingFencePattern) {
			fencedLines.add(index);

			if (closingFencePattern.test(text)) {
				closingFencePattern = undefined;
			}

			continue;
		}

		// A fence can open a list item, even a nested one
		const [fence] =
			FENCE_PATTERN.exec(text.replace(LIST_MARKERS_PATTERN, '')) ?? [];

		if (fence) {
			fencedLines.add(index);
			closingFencePattern = new RegExp(
				`^${fence[0]!}{${fence.length},}[ \\t]*$`
			);
		}
	}

	return fencedLines;
}

/**
 * Fills lines greedily using the print width as a target, starting the first
 * line with a prefix and later lines with a continuation prefix.
 */
export function fillCommentText(
	text: string,
	prefix: string,
	continuation: string,
	options: CommentBlockOptions
): string[] {
	return fillWords(splitWords(text), prefix, continuation, options);
}

/**
 * Reads comment lines into paragraphs, list items, and lines kept as written,
 * such as those in code fences.
 */
function parseNodes(
	lines: ReadonlyArray<string>,
	{ syntax }: CommentBlockOptions
): BlockNode[] {
	const { marker } = syntax;
	const markerPattern = getMarkerPattern(marker);
	const nodes: BlockNode[] = [];
	const fencedLines = findFencedLines(lines, marker);
	const texts = lines.map((line, index) =>
		fencedLines.has(index)
			? ''
			: line.replace(markerPattern, '').replace(/^[ \t]*/, '')
	);
	let openNode: Extract<BlockNode, { texts: string[] }> | undefined;
	let keptItemContinuation: string | undefined;

	for (const [index, line] of lines.entries()) {
		const previousContinuation = keptItemContinuation;
		keptItemContinuation = undefined;
		const rest = line.replace(markerPattern, '');
		const [indentation] = /^[ \t]*/.exec(rest)!;
		const text = rest.slice(indentation.length);
		const linePrefix = marker + indentation;

		// Code fences keep their content as written, including empty lines
		if (fencedLines.has(index)) {
			nodes.push({ isDirective: false, line, type: 'verbatim' });
			openNode = undefined;
			continue;
		}

		if (text === '') {
			nodes.push(EMPTY_NODE);
			openNode = undefined;
			continue;
		}

		const listMarker = LIST_MARKER_PATTERN.exec(text);
		const keepLine = syntax.isLineKept(texts, index, lines);

		if (keepLine || syntax.hasLineSensitiveMarker?.(line)) {
			if (!keepLine && !syntax.isDirective(text)) {
				const continuation =
					openNode && 'continuation' in openNode
						? openNode.continuation
						: previousContinuation;

				if (listMarker) {
					const padding = listMarker[0].slice(listMarker[1]!.length);

					// Extra padding can begin a Markdown code block
					if (/^ {1,4}$/.test(padding)) {
						keptItemContinuation = `${linePrefix}${' '.repeat(listMarker[0].length)}`;
					}
				} else if (continuation?.startsWith(linePrefix)) {
					keptItemContinuation = continuation;
				}
			}

			nodes.push({ line, type: 'kept' });
			openNode = undefined;
			continue;
		}

		if (listMarker) {
			const itemIndentation = indentation || ' ';
			openNode = {
				continuation: `${marker}${itemIndentation}${' '.repeat(listMarker[1]!.length + 1)}`,
				lines: [line],
				prefix: `${marker}${itemIndentation}${listMarker[1]!} `,
				texts: [text.slice(listMarker[0].length)],
				type: 'item',
			};
			nodes.push(openNode);
			continue;
		}

		const isIndented = indentation.length > 1 || indentation === '\t';

		if (syntax.isDirective(text)) {
			nodes.push({ isDirective: true, line, type: 'verbatim' });
			openNode = undefined;
			continue;
		}

		// An ordinary list item can include lazy continuations, while prose
		// that resumes below a kept line uses the item’s continuation indent
		if (
			openNode?.type === 'item' ||
			(openNode?.type === 'continuation' &&
				openNode.continuation === linePrefix)
		) {
			openNode.lines.push(line);
			openNode.texts.push(text);
			continue;
		}

		if (previousContinuation === linePrefix) {
			openNode = {
				continuation: linePrefix,
				lines: [line],
				prefix: linePrefix,
				texts: [text],
				type: 'continuation',
			};
			nodes.push(openNode);
			continue;
		}

		if (isIndented) {
			nodes.push({ isDirective: false, line, type: 'verbatim' });
			openNode = undefined;
			continue;
		}

		const words = splitWords(text).join(' ');
		const paragraphWords =
			openNode?.type === 'paragraph'
				? `${openNode.words} ${words}`
				: words;

		// Keep the line as written on its own when joining lines or collapsing
		// spaces would turn the paragraph into a directive, as with `c8`
		// followed by `ignore next`, or `pragma:  allowlist nextline secret`
		if (syntax.isDirective(paragraphWords)) {
			nodes.push({ line, type: 'kept' });
			openNode = undefined;
			continue;
		}

		if (openNode?.type === 'paragraph') {
			openNode.lines.push(line);
			openNode.texts.push(text);
			openNode.words = paragraphWords;
			continue;
		}

		if (syntax.isUnsafeParagraphStart(line)) {
			nodes.push({ line, type: 'kept' });
			continue;
		}

		openNode = { lines: [line], texts: [text], type: 'paragraph', words };
		nodes.push(openNode);
	}

	return nodes;
}

/**
 * Surrounds directives with empty comment lines, except next to lines the
 * syntax keeps, then removes repeated empty lines and those at either end of
 * the block.
 */
function separateNodes(nodes: ReadonlyArray<BlockNode>): BlockNode[] {
	const separatedNodes: BlockNode[] = [];

	for (const [index, node] of nodes.entries()) {
		const previousNode = nodes[index - 1];

		if (
			previousNode &&
			isDirective(node) !== isDirective(previousNode) &&
			![node.type, previousNode.type].some(
				(type) => type === 'empty' || type === 'kept'
			)
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

	// Removing every line can leave a stray blank line that a later formatting
	// pass collapses
	return separatedNodes.length > 0 ? separatedNodes : [EMPTY_NODE];
}

/**
 * Checks whether a node is a directive.
 */
function isDirective(node: BlockNode): boolean {
	return node.type === 'verbatim' && node.isDirective;
}

/**
 * Prints a node as comment lines.
 */
function printNode(node: BlockNode, options: CommentBlockOptions): string[] {
	const { marker } = options.syntax;

	switch (node.type) {
		case 'empty':
			return [marker];

		case 'continuation':

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
				`${marker} `,
				`${marker} `,
				options
			);

		case 'kept':

		case 'verbatim':
			return [node.line];
	}
}

/**
 * Splits text at spaces and tabs outside code spans and inline tags such as
 * `{@link …}`, which stay whole.
 */
function splitWords(text: string): string[] {
	const words: string[] = [];
	let word = '';

	for (let index = 0; index < text.length; index += 1) {
		const character = text[index]!;

		if (
			character === '`' ||
			(character === '{' && text[index + 1] === '@')
		) {
			const end = text.indexOf(character === '`' ? '`' : '}', index + 1);

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
 * Fills lines greedily without starting new markup or directives.
 */
function fillWords(
	words: ReadonlyArray<string>,
	prefix: string,
	continuation: string,
	{ indentation, printWidth, syntax, tabWidth }: CommentBlockOptions
): string[] {
	const markerPattern = getMarkerPattern(syntax.marker);
	const fits = (line: string) =>
		getLineWidth(indentation + line, tabWidth) <= printWidth;

	if (words.length === 0) {
		return [prefix.trimEnd()];
	}

	const lines: string[] = [];
	const lastWordIndex = words.findLastIndex((word) => word.trim() !== '');
	let line = prefix + words[0]!;

	for (const [index, word] of words.entries().drop(1)) {
		const extendedLine = `${line} ${word}`;

		// A break can start markup or a directive on the next line. It can also
		// leave a marker like `prettier-ignore` alone on the current line
		if (
			fits(extendedLine) ||
			syntax.isBlockKept(line) ||
			syntax.isDirective(
				line.replace(markerPattern, '').replace(/^[ \t]*/, '')
			) ||
			FENCE_PATTERN.test(word) ||
			LIST_MARKER_PATTERN.test(word) ||
			syntax.isUnsafeLineStart(word, index === lastWordIndex)
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
 * Returns a pattern for the marker that starts a comment line. Repeating its
 * last character, as in `##` or `///`, still reads as one marker.
 */
function getMarkerPattern(marker: string): RegExp {
	return new RegExp(
		`^${RegExp.escape(marker)}${RegExp.escape(marker.at(-1)!)}*`
	);
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
