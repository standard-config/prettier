import type { CommentSyntax } from '@standard-config/utilities/types';
import type { ParserOptions } from 'prettier';
import type { FoundComment, FoundComments } from '../find-comments/index.ts';
import type {
	CommentEdit,
	Conversion,
	ParserName,
	PluginOptions,
	TextEdit,
} from '../types/index.d.ts';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';
import formatCommentBlock, {
	findFencedLines,
} from '@standard-config/utilities/format-comment-block';
import {
	BLOCK_DIRECTIVE_PATTERN,
	COMMENT_SYNTAX,
	FALL_THROUGH_PATTERN,
	TYPESCRIPT_SUPPRESSION_PATTERN,
} from '../constants/index.ts';
import findComments, { formatCode } from '../find-comments/index.ts';
import formatBlockComment from '../format-block-comment/index.ts';
import mapCursor from '../map-cursor/index.ts';
import moveTrailingComments, {
	findDirectiveAbove,
	getCommentText,
	isContinuedList,
} from '../move-trailing-comments/index.ts';

type GroupContext = {
	found: FoundComments;
	/**
	 * Offsets of comments that stay `//` comments.
	 */
	keptStarts: ReadonlySet<number>;
};

const EMPTY_LINE_PATTERN = /^\/+[ \t]*$/;

// Keep the block’s first line as written when a directive on the line above
// covers it
const FIRST_LINE_KEPT_SYNTAX: CommentSyntax = {
	...COMMENT_SYNTAX,
	isLineKept: (texts, index) =>
		index === 0 || COMMENT_SYNTAX.isLineKept(texts, index),
};

/**
 * Reflows comments on lines of their own, using the print width as a target.
 * When `tsCommentWrap` is `all`, also moves eligible trailing `//` comments
 * onto their own lines. Converts supported `//` directives to block comments
 * when their tools read them in that form.
 */
export default async function wrapComments(
	originalText: string,
	name: ParserName,
	options: ParserOptions
): Promise<string> {
	if (!/\/[*/]/.test(originalText)) {
		return originalText;
	}

	let text = originalText;
	let found = await findComments(text, name, options);

	// Prettier can move code onto or off a trailing comment’s line. Format
	// first so every edit uses the lines Prettier prints
	if (
		(options as PluginOptions).tsCommentWrap !== 'full-line' &&
		found.hasRewrittenLines
	) {
		({ cursorOffset: options.cursorOffset, text } = await formatCode(
			text,
			name,
			options
		));
		found = await findComments(text, name, options);
	}

	const { comments } = found;
	const ownLineComments = comments.filter(({ isTrailing }) => !isTrailing);
	const groups = groupComments(
		text,
		ownLineComments.filter(({ start }) => text.startsWith('//', start))
	);
	const blockComments = ownLineComments.filter(({ start }) =>
		text.startsWith('/*', start)
	);
	const indentations = new Map<number, string>();
	const keptStarts = new Set<number>();
	const createAllEdits = () =>
		createEdits(
			text,
			groups,
			blockComments,
			(options as PluginOptions).tsCommentWrap === 'full-line'
				? []
				: moveTrailingComments(text, found, options, {
						indentations,
						keptStarts,
					}),
			options,
			{ found, keptStarts }
		);
	let edits = createAllEdits();

	// Prettier can print a block comment inline in an otherwise empty object,
	// or join the lines around one that follows code, which may change the code
	// a directive covers. Format the edited code again and keep directives as
	// `//` if they wouldn’t stay where they were. Moved comments reflow at the
	// indentation where they print, or stay in place if Prettier would print
	// them after code again
	const { conversions, moves } = findEditedOffsets(edits);

	if (conversions.length > 0 || moves.length > 0) {
		const { comments: editedComments, lineEndStarts } = await findComments(
			applyEdits(text, edits),
			name,
			options
		);
		const ownLineComments = new Map(
			editedComments
				.filter(({ isTrailing }) => !isTrailing)
				.map((comment) => [comment.start, comment])
		);

		for (const { isTrailing, offset, start } of conversions) {
			if (!(isTrailing ? lineEndStarts : ownLineComments).has(offset)) {
				keptStarts.add(start);
			}
		}

		for (const { offset, start } of moves) {
			const movedComment = ownLineComments.get(offset);

			if (movedComment) {
				indentations.set(start, movedComment.indentation);
			} else {
				keptStarts.add(start);
			}
		}

		if (keptStarts.size > 0 || indentations.size > 0) {
			edits = createAllEdits();
		}
	}

	options.cursorOffset = mapCursor(
		text,
		edits,
		options.cursorOffset as number
	);

	return applyEdits(text, edits);
}

/**
 * Applies edits ordered by their starting positions.
 */
function applyEdits(text: string, edits: ReadonlyArray<TextEdit>): string {
	return edits
		.toReversed()
		.reduce(
			(result, edit) =>
				result.slice(0, edit.start) +
				edit.text +
				result.slice(edit.end),
			text
		);
}

/**
 * Collects comment formatting changes in source order, including the edits that
 * move trailing comments.
 */
function createEdits(
	text: string,
	groups: ReadonlyArray<ReadonlyArray<FoundComment>>,
	blockComments: ReadonlyArray<FoundComment>,
	moves: ReadonlyArray<CommentEdit>,
	options: ParserOptions,
	context: GroupContext
): CommentEdit[] {
	const movedStarts = new Set(
		moves.filter(({ source }) => source).map(({ start }) => start)
	);
	const separatedStarts = new Set<number>();
	const edits: CommentEdit[] = [
		...moves,
		...groups.map((group) =>
			formatGroupAboveMoves(
				text,
				{
					end: group.at(-1)!.end,
					start: group[0]!.start,
					...formatGroup(text, group, options, context),
				},
				movedStarts,
				separatedStarts
			)
		),
		...blockComments.map(({ end, indentation, start }) => ({
			conversions: [],
			end,
			start,
			text:
				formatBlockComment(text.slice(start, end), {
					indentation,
					printWidth: options.printWidth,
					tabWidth: options.tabWidth,
				}) ?? text.slice(start, end),
		})),
	]
		.filter((edit) => edit.text !== text.slice(edit.start, edit.end))
		.toSorted((a, b) => a.start - b.start);

	// Only the first comment moved above a line can need an empty `//` line
	// before it to separate it from existing comments, and only the last can
	// need one after it
	const movedEdits = edits.filter(({ source }) => source);
	const firstMoves = new Map(
		movedEdits.toReversed().map((edit) => [edit.start, edit])
	);
	const lastMoves = new Map(movedEdits.map((edit) => [edit.start, edit]));

	return edits.map((edit) => {
		let result = edit;

		if (
			firstMoves.get(edit.start) === edit &&
			separatedStarts.has(edit.start)
		) {
			const linePrefix = edit.text.slice(edit.text.lastIndexOf('\n') + 1);

			result = {
				...result,
				movedLine: 1,
				text: `//\n${linePrefix}${result.text}`,
			};
		}

		return lastMoves.get(edit.start) === edit
			? separateMovedComments(text, result, edits)
			: result;
	});
}

/**
 * Adjusts spacing above moved comments to preserve groups on the next run.
 */
function formatGroupAboveMoves(
	text: string,
	edit: CommentEdit,
	movedStarts: ReadonlySet<number>,
	separatedStarts: Set<number>
): CommentEdit {
	const nextLinePattern = /[ \t]*\n?[ \t]*/y;
	nextLinePattern.lastIndex = edit.end;
	const codeStart = edit.end + nextLinePattern.exec(text)![0].length;

	if (!movedStarts.has(codeStart)) {
		return edit;
	}

	const lines = edit.text.split('\n');
	const lastIndex = lines.findLastIndex(
		(line) => !EMPTY_LINE_PATTERN.test(line)
	);

	if (lastIndex === -1) {
		return { conversions: [], end: codeStart, start: edit.start, text: '' };
	}

	if (!lines[lastIndex]!.startsWith('//')) {
		return { ...edit, text: lines.slice(0, lastIndex + 1).join('\n') };
	}

	if (lastIndex === lines.length - 1) {
		separatedStarts.add(codeStart);
	}

	return edit;
}

/**
 * Adds an empty `//` line after the comments moved above a `//` comment that
 * stays `//` once its group is formatted, which would otherwise join the two on
 * the next run.
 */
function separateMovedComments(
	text: string,
	edit: CommentEdit,
	edits: ReadonlyArray<CommentEdit>
): CommentEdit {
	// The group edit, if any, starts where the moved comments are inserted
	const groupEdit = edits.find(
		({ source, start }) => start === edit.start && !source
	);

	if (!(groupEdit?.text ?? text.slice(edit.start)).startsWith('//')) {
		return edit;
	}

	const linePrefix = edit.text.slice(edit.text.lastIndexOf('\n') + 1);

	return { ...edit, text: `${edit.text}//\n${linePrefix}` };
}

/**
 * Returns the original and edited offsets of each converted comment and each
 * comment moved to another line.
 */
function findEditedOffsets(edits: ReadonlyArray<CommentEdit>): {
	conversions: Array<Omit<Conversion, 'line'> & { offset: number }>;
	moves: Array<{ offset: number; start: number }>;
} {
	const conversions: Array<Omit<Conversion, 'line'> & { offset: number }> =
		[];
	const moves: Array<{ offset: number; start: number }> = [];
	let shift = 0;

	for (const edit of edits) {
		const lineStarts = [0];

		for (
			let index = edit.text.indexOf('\n');
			index !== -1;
			index = edit.text.indexOf('\n', index + 1)
		) {
			lineStarts.push(index + 1);
		}

		for (const { isTrailing, line, start } of edit.conversions) {
			conversions.push({
				isTrailing,
				offset: edit.start + shift + lineStarts[line]!,
				start,
			});
		}

		if (edit.movedLine !== undefined) {
			const lineStart = lineStarts[edit.movedLine]!;

			moves.push({
				offset:
					edit.start +
					shift +
					lineStart +
					/^[ \t]*/.exec(edit.text.slice(lineStart))![0].length,
				start: edit.source!.start,
			});
		}

		shift += edit.text.length - (edit.end - edit.start);
	}

	return { conversions, moves };
}

/**
 * Groups comments on consecutive lines.
 */
function groupComments(
	text: string,
	comments: ReadonlyArray<FoundComment>
): FoundComment[][] {
	const groups: FoundComment[][] = [];

	for (const comment of comments) {
		const previousComment = groups.at(-1)?.at(-1);

		if (
			previousComment &&
			/^[ \t]*\n[ \t]*$/.test(
				text.slice(previousComment.end, comment.start)
			)
		) {
			groups.at(-1)!.push(comment);
		} else {
			groups.push([comment]);
		}
	}

	return groups;
}

/**
 * Formats a comment group and keeps its lines separate from surrounding code.
 */
function formatGroup(
	text: string,
	group: ReadonlyArray<FoundComment>,
	options: ParserOptions,
	{ found, keptStarts }: GroupContext
): { conversions: Conversion[]; text: string } {
	const lines = group.map(({ end, start }) =>
		text.slice(start, end).trimEnd()
	);
	const { indentation } = group[0]!;
	const conversions: Conversion[] = [];

	if (lines.some((line) => COMMENT_SYNTAX.isBlockKept(line))) {
		return {
			conversions,
			text: text.slice(group[0]!.start, group.at(-1)!.end),
		};
	}

	const fencedLines = findFencedLines(lines, COMMENT_SYNTAX.marker);
	const formattedLines: string[] = [];
	let block: string[] = [];

	const lineStart = text.lastIndexOf('\n', group[0]!.start - 1) + 1;
	const isAfterCode = text.slice(lineStart, group[0]!.start).trim() !== '';

	// Converting part of a directive’s list that continues on the next line
	// would apply only part of the setting, and reflowing could merge its
	// entries into the prose around them, so the list and the lines after it
	// stay as written
	let keptIndex = isBelowContinuedDirective(text, lineStart, lines[0]!, found)
		? 0
		: lines.findIndex(
				(line, index) =>
					index < lines.length - 1 &&
					!fencedLines.has(index) &&
					isContinuedDirective(line, lines[index + 1]!)
			);

	// The empty lines before the list stay with it
	while (keptIndex > 0 && EMPTY_LINE_PATTERN.test(lines[keptIndex - 1]!)) {
		keptIndex -= 1;
	}

	if (keptIndex === 0) {
		return {
			conversions,
			text: text.slice(group[0]!.start, group.at(-1)!.end),
		};
	}

	// A next-line directive can sit above the group or end up outside the
	// following block after conversion
	const directiveAbove = findDirectiveAbove(text, lineStart, found);
	let isBelowDirective =
		directiveAbove !== undefined &&
		NEXT_LINE_DIRECTIVE_PATTERN.test(
			getCommentText(text.slice(directiveAbove.start, directiveAbove.end))
		);

	const convert = (commentText: string, start: number) => {
		// Prettier keeps a block comment on the line of the code it follows, so
		// a converted directive after code starts a line of its own
		if (isAfterCode && formattedLines.length === 0) {
			formattedLines.push('');
		}

		conversions.push({
			isTrailing: false,
			line: formattedLines.length,
			start,
		});
		formattedLines.push(`/* ${commentText} */`);
		isBelowDirective = NEXT_LINE_DIRECTIVE_PATTERN.test(commentText);
	};

	const flushBlock = () => {
		if (block.some((line) => !EMPTY_LINE_PATTERN.test(line))) {
			// An empty `//` line that the directive covers keeps it from
			// covering the comment below
			if (isBelowDirective && EMPTY_LINE_PATTERN.test(block[0]!)) {
				formattedLines.push('//');
			}

			formattedLines.push(
				...formatCommentBlock(block, {
					indentation,
					joinLines: true,
					printWidth: options.printWidth,
					syntax: isBelowDirective
						? FIRST_LINE_KEPT_SYNTAX
						: COMMENT_SYNTAX,
					tabWidth: options.tabWidth,
				})
			);
		}

		const lastText = (formattedLines.at(-1) ?? '').replace(
			/^\/+[ \t]*/,
			''
		);

		// Keep an empty `//` line after a directive so the directive doesn’t
		// start covering the code below
		if (
			EMPTY_LINE_PATTERN.test(block.at(-1) ?? '') &&
			(conversions.at(-1)?.line === formattedLines.length - 1 ||
				COMMENT_SYNTAX.isDirective(lastText))
		) {
			formattedLines.push('//');
		}

		block = [];
		isBelowDirective = false;
	};

	// ESLint’s `no-fallthrough` rule only recognizes a fall-through comment
	// when it’s the last comment before a `case` or `default`, or at the end of
	// a block that forms a clause’s whole body
	const nextCodePattern = /\S/g;
	nextCodePattern.lastIndex = group.at(-1)!.end;
	const isAtFallThroughPosition = found.fallThroughOffsets.has(
		nextCodePattern.exec(text)?.index ?? -1
	);

	// TypeScript skips only empty lines and `//` lines between a suppression
	// and the code it covers, so keep later comments in the group as `//`
	let isAfterSuppression = isBelowSuppression(text, group[0]!.start);

	for (const [index, line] of lines
		.slice(0, keptIndex === -1 ? undefined : keptIndex)
		.entries()) {
		const commentText = line.replace(/^\/+[ \t]*/, '');
		const isFallThrough =
			isAtFallThroughPosition &&
			index === lines.length - 1 &&
			FALL_THROUGH_PATTERN.test(commentText);

		// Only directives after exactly two slashes and outside code fences are
		// eligible for conversion
		if (
			!isAfterSuppression &&
			!fencedLines.has(index) &&
			!keptStarts.has(group[index]!.start) &&
			/^\/\/(?!\/)/.test(line) &&
			(BLOCK_DIRECTIVE_PATTERN.test(commentText) || isFallThrough) &&
			!commentText.includes('*/')
		) {
			flushBlock();
			convert(commentText, group[index]!.start);
		} else {
			block.push(line);
		}

		isAfterSuppression ||= TYPESCRIPT_SUPPRESSION_PATTERN.test(commentText);
	}

	flushBlock();
	formattedLines.push(
		...lines.slice(keptIndex === -1 ? lines.length : keptIndex)
	);

	// Joining lines can turn the last one into a fall-through comment
	const lastLine = formattedLines.at(-1) ?? '';
	const lastText = lastLine.replace(/^\/\/[ \t]*/, '');

	if (
		keptIndex === -1 &&
		isAtFallThroughPosition &&
		!isAfterSuppression &&
		!fencedLines.has(lines.length - 1) &&
		!keptStarts.has(group.at(-1)!.start) &&
		/^\/\/(?!\/)/.test(lastLine) &&
		FALL_THROUGH_PATTERN.test(lastText) &&
		!lastText.includes('*/')
	) {
		formattedLines.pop();
		convert(lastText, group.at(-1)!.start);
	}

	return {
		conversions,
		// Removing every line would leave a blank line in place of the comments
		text: (formattedLines.length > 0 ? formattedLines : ['//']).join('\n'),
	};
}

/**
 * Returns whether a `//` comment holds a directive whose list continues on the
 * `//` line after it.
 */
function isContinuedDirective(comment: string, nextLine: string): boolean {
	return (
		comment.startsWith('//') &&
		isContinuedList(comment.replace(/^\/\/[ \t]*/, ''), nextLine)
	);
}

/**
 * Returns whether this `//` line continues a directive’s list from the previous
 * `//` comment.
 */
function isBelowContinuedDirective(
	text: string,
	lineStart: number,
	line: string,
	{ comments }: FoundComments
): boolean {
	const previousLineStart = text.lastIndexOf('\n', lineStart - 2) + 1;

	return comments.some(
		({ end, start }) =>
			end >= previousLineStart &&
			end < lineStart &&
			isContinuedDirective(text.slice(start, end).trimEnd(), line)
	);
}

/**
 * Returns whether a TypeScript suppression comes before an offset, with only
 * empty lines and `//` comments in between, as TypeScript reads them.
 */
function isBelowSuppression(text: string, offset: number): boolean {
	let lineEnd = text.lastIndexOf('\n', offset - 1);

	while (lineEnd !== -1) {
		// `lastIndexOf` treats a negative position as `0`, so it would find the
		// newline at offset `0` again
		const lineStart =
			lineEnd > 0 ? text.lastIndexOf('\n', lineEnd - 1) + 1 : 0;
		const line = text.slice(lineStart, lineEnd);

		// TypeScript reads suppressions from `//` comments anywhere on a line
		// and from the last line of a block comment. For a one-line block
		// comment after code, that last line starts at `/*`
		if (
			/(?:^[ \t]*[*/]*|\/[*/]+)[ \t]*@ts-(?:expect-error|ignore)\b/.test(
				line
			)
		) {
			return true;
		}

		if (!/^[ \t]*(?:\/\/|$)/.test(line)) {
			return false;
		}

		lineEnd = lineStart - 1;
	}

	return false;
}
