import type { Options, ParserOptions, Printer } from 'prettier';
import type { ParserName, TextRange } from '../types/index.d.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { format, formatWithCursor, getSupportInfo } from 'prettier';

export type FoundComment = {
	/**
	 * Offset after the last character of the comment.
	 */
	end: number;
	/**
	 * Spaces and tabs at the start of the comment’s line after formatting.
	 */
	indentation: string;
	/**
	 * Whether code precedes the comment on its line after formatting.
	 */
	isTrailing: boolean;
	/**
	 * Offset of the first character of the comment.
	 */
	start: number;
};

export type FoundComments = {
	comments: FoundComment[];
	/**
	 * Offsets used to check fall-through comment placement: the start of each
	 * `case` or `default` clause and the closing brace of a block that forms a
	 * clause’s whole body.
	 */
	fallThroughOffsets: Set<number>;
	/**
	 * Whether the code before a trailing `//` comment differs between its
	 * source and printed lines, ignoring whitespace.
	 */
	hasRewrittenLines: boolean;
	/**
	 * Ranges of JSX elements and fragments.
	 */
	jsxElementRanges: TextRange[];
	/**
	 * Ranges of JSX text, whose lines Prettier can join or split.
	 */
	jsxTextRanges: TextRange[];
	/**
	 * Offsets of single-line comments that Prettier prints at the end of a
	 * line.
	 */
	lineEndStarts: Set<number>;
	/**
	 * Ranges of strings, template text, and block comments, where inserted text
	 * would become part of them.
	 */
	textRanges: TextRange[];
};

type SwitchCase = {
	consequent: Array<{ type: string }>;
};

// Prettier handles pragmas, the cursor, and ranges outside the parser
const EXCLUDED_OPTIONS = new Set([
	'checkIgnorePragma',
	'cursorOffset',
	'insertPragma',
	'parser',
	'plugins',
	'rangeEnd',
	'rangeStart',
	'requirePragma',
]);

// Prettier counts control characters as zero columns wide, so marks made of
// them leave the layout unchanged
/* oxlint-disable-next-line no-control-regex */
const MARK_PATTERN = /\u0001([\u0010-\u0019]+)\u0002/g;

const findingComments = new AsyncLocalStorage<true>();

/**
 * Finds the comments that Prettier prints on lines of their own and the `//`
 * comments that follow code, along with the indentation of their lines.
 * Comments that Prettier prints as written, such as those in code after a
 * `prettier-ignore` comment, aren’t included. Also returns offsets used to
 * check fall-through comment placement, the offsets of single-line comments
 * printed at the end of a line, and the ranges of JSX elements, JSX text,
 * strings, template text, and block comments.
 */
export default async function findComments(
	text: string,
	name: ParserName,
	options: ParserOptions
): Promise<FoundComments> {
	const printer = options.printer as Printer;
	const markedComments: Array<Pick<FoundComment, 'end' | 'start'>> = [];
	let fallThroughOffsets = new Set<number>();
	let jsxElementRanges: TextRange[] = [];
	let jsxTextRanges: TextRange[] = [];
	let textRanges: TextRange[] = [];

	// Code that holds a mark character can’t be marked reliably
	if (text.includes('\u0001')) {
		return {
			comments: [],
			fallThroughOffsets,
			hasRewrittenLines: false,
			jsxElementRanges,
			jsxTextRanges,
			lineEndStarts: new Set(),
			textRanges,
		};
	}

	// Mark each comment as Prettier prints it, which leaves the code it parses
	// unchanged
	const markingPrinter: Printer = {
		...printer,
		preprocess(ast: unknown, printOptions) {
			if (printOptions.originalText === text) {
				({
					fallThroughOffsets,
					jsxElementRanges,
					jsxTextRanges,
					textRanges,
				} = collectNodes(ast, printOptions));
			}

			return printer.preprocess
				? (printer.preprocess(ast, printOptions) as unknown)
				: ast;
		},
		printComment(path, printOptions) {
			const printed = printer.printComment!(path, printOptions);
			const start = printOptions.locStart(path.node);
			const end = printOptions.locEnd(path.node);

			// Code embedded in the code, such as in an HTML template, has offsets
			// of its own
			if (
				printOptions.originalText !== text ||
				!/^\/[*/]/.test(text.slice(start, end))
			) {
				return printed;
			}

			markedComments.push({ end, start });
			return [createMark(markedComments.length - 1), printed];
		},
	};

	let markedCode: string;

	try {
		markedCode = await findingComments.run(true, async () =>
			format(text, {
				...(await getFormatOptions(options)),
				// Prettier applies line endings when it prints, so the code it
				// parses always uses `\n`
				endOfLine: 'lf',
				parser: name,
				plugins: [
					...options.plugins,
					{
						printers: {
							[options.astFormat as string]: markingPrinter,
						},
					},
				],
			})
		);
	} catch {
		// Prettier reports errors in the code when it parses the code itself
		return {
			comments: [],
			fallThroughOffsets,
			hasRewrittenLines: false,
			jsxElementRanges,
			jsxTextRanges,
			lineEndStarts: new Set(),
			textRanges,
		};
	}

	const comments = new Map<number, FoundComment>();
	const lineEndStarts = new Set<number>();
	let hasRewrittenLines = false;

	for (const match of markedCode.matchAll(MARK_PATTERN)) {
		const index = match[1]!
			.split('')
			.map((digit) => digit.codePointAt(0)! - 0x10)
			.join('');
		const comment = markedComments[Number(index)]!;
		const lineStart = markedCode.lastIndexOf('\n', match.index - 1) + 1;

		// A line can hold several comments, each with its own mark
		const linePrefix = markedCode
			.slice(lineStart, match.index)
			.replaceAll(MARK_PATTERN, '');
		const [indentation] = /^[ \t]*/.exec(linePrefix)!;
		const isTrailing = linePrefix.trim() !== '';
		// Prettier prints `//` comments without trailing whitespace
		const commentText = text.slice(comment.start, comment.end).trimEnd();
		const printedEnd = match.index + match[0].length + commentText.length;

		if (
			!commentText.includes('\n') &&
			/^[ \t]*(?:\n|$)/.test(markedCode.slice(printedEnd))
		) {
			lineEndStarts.add(comment.start);
		}

		const sourcePrefix = text.slice(
			text.lastIndexOf('\n', comment.start - 1) + 1,
			comment.start
		);

		if (
			isTrailing &&
			text.startsWith('//', comment.start) &&
			sourcePrefix.replaceAll(/\s/g, '') !==
				linePrefix.replaceAll(/\s/g, '')
		) {
			hasRewrittenLines = true;
		}

		// A block comment can share a line with code on either side, so leave
		// it as written unless it occupies its own lines
		if (
			text.startsWith('//', comment.start) ||
			(!isTrailing && isOnOwnLine(text, comment.start, comment.end))
		) {
			comments.set(comment.start, {
				...comment,
				indentation,
				isTrailing,
			});
		}
	}

	return {
		comments: [...comments.values()].toSorted((a, b) => a.start - b.start),
		fallThroughOffsets,
		hasRewrittenLines,
		jsxElementRanges,
		jsxTextRanges,
		lineEndStarts,
		textRanges,
	};
}

/**
 * Formats code with Prettier and its plugins, with this plugin’s changes
 * disabled. Returns the formatted text and its cursor offset.
 */
export async function formatCode(
	text: string,
	name: ParserName,
	options: ParserOptions
): Promise<{ cursorOffset: number; text: string }> {
	const { cursorOffset, formatted } = await findingComments.run(
		true,
		async () =>
			formatWithCursor(text, {
				...(await getFormatOptions(options)),
				cursorOffset: options.cursorOffset as number,
				endOfLine: 'lf',
				parser: name,
				plugins: options.plugins,
			})
	);

	return { cursorOffset, text: formatted };
}

/**
 * Returns whether this plugin is formatting code to find its comments.
 */
export function isFindingComments(): boolean {
	return findingComments.getStore() === true;
}

/**
 * Returns a mark for the comment at an index, made of control characters.
 */
function createMark(index: number): string {
	const digits = String(index)
		.split('')
		.map((digit) => String.fromCodePoint(0x10 + Number(digit)));

	return `\u0001${digits.join('')}\u0002`;
}

/**
 * Collects clause starts and closing braces used to check fall-through comment
 * placement, and the ranges of JSX elements, JSX text, strings, template text,
 * and block comments.
 */
function collectNodes(
	ast: unknown,
	options: ParserOptions
): Omit<FoundComments, 'comments' | 'hasRewrittenLines' | 'lineEndStarts'> {
	const fallThroughOffsets = new Set<number>();
	const jsxElementRanges: TextRange[] = [];
	const jsxTextRanges: TextRange[] = [];
	const textRanges: TextRange[] = [];
	const visited = new Set<unknown>();
	const nodes = [ast];

	while (nodes.length > 0) {
		const node = nodes.pop();

		if (typeof node !== 'object' || node === null || visited.has(node)) {
			continue;
		}

		visited.add(node);

		const { type, value } = node as { type?: unknown; value?: unknown };

		if (type === 'SwitchCase') {
			addFallThroughOffsets(
				node as SwitchCase,
				fallThroughOffsets,
				options
			);
		}

		// Parsers can require their location functions to receive nodes, so the
		// walk measures only the nodes it records
		if (type === 'JSXElement' || type === 'JSXFragment') {
			jsxElementRanges.push({
				end: options.locEnd(node),
				start: options.locStart(node),
			});
		} else if (type === 'JSXText') {
			jsxTextRanges.push({
				end: options.locEnd(node),
				start: options.locStart(node),
			});
		} else if (
			type === 'Block' ||
			type === 'CommentBlock' ||
			type === 'TemplateElement' ||
			(typeof value === 'string' && String(type).endsWith('Literal'))
		) {
			textRanges.push({
				end: options.locEnd(node),
				start: options.locStart(node),
			});
		}

		// Prettier links comments to the nodes around them, so the walk skips
		// nodes it has seen. Pushing values one at a time keeps a large array
		// from overflowing the call stack
		for (const value of Object.values(node as Record<string, unknown>)) {
			nodes.push(value);
		}
	}

	return { fallThroughOffsets, jsxElementRanges, jsxTextRanges, textRanges };
}

/**
 * Adds the offsets of a `switch` clause and of the closing brace of a block
 * that forms its whole body.
 */
function addFallThroughOffsets(
	node: SwitchCase,
	offsets: Set<number>,
	options: ParserOptions
): void {
	const { consequent } = node;

	offsets.add(options.locStart(node));

	if (consequent.length === 1 && consequent[0]!.type === 'BlockStatement') {
		offsets.add(options.locEnd(consequent[0]) - 1);
	}
}

/**
 * Returns whether nothing but whitespace surrounds a comment on its lines.
 */
function isOnOwnLine(text: string, start: number, end: number): boolean {
	const lineStart = text.lastIndexOf('\n', start - 1) + 1;
	const lineEnd = text.indexOf('\n', end);

	return (
		/^[ \t]*$/.test(text.slice(lineStart, start)) &&
		/^[ \t]*$/.test(text.slice(end, lineEnd === -1 ? undefined : lineEnd))
	);
}

/**
 * Returns the formatting options that Prettier and its plugins support,
 * leaving out those that Prettier handles outside the parser.
 */
async function getFormatOptions(options: ParserOptions): Promise<Options> {
	const { options: supportedOptions } = await getSupportInfo({
		plugins: options.plugins,
	});
	const supportedNames = new Set(supportedOptions.map(({ name }) => name));

	return Object.fromEntries(
		Object.entries(options).filter(
			([name]) => supportedNames.has(name) && !EXCLUDED_OPTIONS.has(name)
		)
	);
}
