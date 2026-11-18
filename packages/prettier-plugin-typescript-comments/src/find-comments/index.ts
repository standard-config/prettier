import type { Options, ParserOptions, Printer } from 'prettier';
import type { ParserName } from '../types/index.d.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { format, getSupportInfo } from 'prettier';

export type FoundComment = {
	/**
	 * Offset after the last character of the comment.
	 */
	end: number;
	/**
	 * Spaces and tabs before the comment once the code is formatted.
	 */
	indentation: string;
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
const MARK_PATTERN = /^([ \t]*)\u0001([\u0010-\u0019]+)\u0002/gm;

const findingComments = new AsyncLocalStorage<true>();

/**
 * Finds the comments that Prettier prints on lines of their own, along with
 * the indentation it gives them. Comments that Prettier prints as written,
 * such as those in code after a `prettier-ignore` comment, aren’t included.
 * Also returns offsets used to check fall-through comment placement.
 */
export default async function findComments(
	text: string,
	name: ParserName,
	options: ParserOptions
): Promise<FoundComments> {
	const printer = options.printer as Printer;
	const markedComments: Array<Omit<FoundComment, 'indentation'>> = [];
	let fallThroughOffsets = new Set<number>();

	// Code that holds a mark character can’t be marked reliably
	if (text.includes('\u0001')) {
		return { comments: [], fallThroughOffsets };
	}

	// Mark each comment as Prettier prints it, which leaves the code it parses
	// unchanged
	const markingPrinter: Printer = {
		...printer,
		preprocess(ast: unknown, printOptions) {
			if (printOptions.originalText === text) {
				fallThroughOffsets = findFallThroughOffsets(ast, printOptions);
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
		return { comments: [], fallThroughOffsets };
	}

	const comments = new Map<number, FoundComment>();

	for (const match of markedCode.matchAll(MARK_PATTERN)) {
		const index = match[2]!
			.split('')
			.map((digit) => digit.codePointAt(0)! - 0x10)
			.join('');
		const comment = markedComments[Number(index)]!;

		// A block comment can start a line that code follows
		if (
			text.startsWith('//', comment.start) ||
			isOnOwnLine(text, comment.start, comment.end)
		) {
			comments.set(comment.start, { ...comment, indentation: match[1]! });
		}
	}

	return {
		comments: [...comments.values()].toSorted((a, b) => a.start - b.start),
		fallThroughOffsets,
	};
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
 * placement.
 */
function findFallThroughOffsets(
	ast: unknown,
	options: ParserOptions
): Set<number> {
	const offsets = new Set<number>();
	const visited = new Set<unknown>();
	const nodes = [ast];

	while (nodes.length > 0) {
		const node = nodes.pop();

		if (typeof node !== 'object' || node === null || visited.has(node)) {
			continue;
		}

		visited.add(node);

		if ((node as { type?: unknown }).type === 'SwitchCase') {
			addFallThroughOffsets(node as SwitchCase, offsets, options);
		}

		// Prettier links comments to the nodes around them, so the walk skips
		// nodes it has seen. Pushing values one at a time keeps a large array
		// from overflowing the call stack
		for (const value of Object.values(node as Record<string, unknown>)) {
			nodes.push(value);
		}
	}

	return offsets;
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
