import type { ParserOptions } from 'prettier';
import type { FoundComment } from '../find-comments/index.ts';
import type { ParserName, TextEdit } from '../types/index.d.ts';
import formatCommentBlock, {
	findFencedLines,
} from '@standard-config/utilities/format-comment-block';
import {
	BLOCK_DIRECTIVE_PATTERN,
	COMMENT_SYNTAX,
	FALL_THROUGH_PATTERN,
	TYPESCRIPT_SUPPRESSION_PATTERN,
} from '../constants/index.ts';
import findComments from '../find-comments/index.ts';
import formatBlockComment from '../format-block-comment/index.ts';
import mapCursor from '../map-cursor/index.ts';

type Conversion = {
	/**
	 * Index of the converted line in the formatted group.
	 */
	line: number;
	/**
	 * Offset of the original comment.
	 */
	start: number;
};

type GroupContext = {
	fallThroughOffsets: ReadonlySet<number>;
	/**
	 * Offsets of comments that stay `//` comments.
	 */
	keptStarts: ReadonlySet<number>;
};

type GroupEdit = TextEdit & { conversions: Conversion[] };

const EMPTY_LINE_PATTERN = /^\/+[ \t]*$/;

/**
 * Reflows comments that occupy lines of their own, using the print width as a
 * target. Converts `//` directives to block comments when tools accept either
 * form.
 */
export default async function wrapComments(
	text: string,
	name: ParserName,
	options: ParserOptions
): Promise<string> {
	if (!/\/[*/]/.test(text)) {
		return text;
	}

	const { comments, fallThroughOffsets } = await findComments(
		text,
		name,
		options
	);
	const groups = groupComments(
		text,
		comments.filter(({ start }) => text.startsWith('//', start))
	);
	const blockComments = comments.filter(({ start }) =>
		text.startsWith('/*', start)
	);
	const keptStarts = new Set<number>();
	let edits = createEdits(text, groups, blockComments, options, {
		fallThroughOffsets,
		keptStarts,
	});

	// Prettier can print a block comment inline in an otherwise empty object,
	// which may change the code a directive covers. Format the edited code again
	// and keep directives as `//` if they wouldn’t stay on lines of their own
	const conversions = findConvertedOffsets(edits);

	if (conversions.length > 0) {
		const { comments: editedComments } = await findComments(
			applyEdits(text, edits),
			name,
			options
		);
		const ownLineStarts = new Set(editedComments.map(({ start }) => start));

		for (const { offset, start } of conversions) {
			if (!ownLineStarts.has(offset)) {
				keptStarts.add(start);
			}
		}

		if (keptStarts.size > 0) {
			edits = createEdits(text, groups, blockComments, options, {
				fallThroughOffsets,
				keptStarts,
			});
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
 * Collects comment formatting changes in source order.
 */
function createEdits(
	text: string,
	groups: ReadonlyArray<ReadonlyArray<FoundComment>>,
	blockComments: ReadonlyArray<FoundComment>,
	options: ParserOptions,
	context: GroupContext
): GroupEdit[] {
	return [
		...groups.map((group) => ({
			end: group.at(-1)!.end,
			start: group[0]!.start,
			...formatGroup(text, group, options, context),
		})),
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
}

/**
 * Returns where each converted comment starts once the edits are applied,
 * along with the offset of the original comment.
 */
function findConvertedOffsets(
	edits: ReadonlyArray<GroupEdit>
): Array<{ offset: number; start: number }> {
	const offsets: Array<{ offset: number; start: number }> = [];
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

		for (const { line, start } of edit.conversions) {
			offsets.push({
				offset: edit.start + shift + lineStarts[line]!,
				start,
			});
		}

		shift += edit.text.length - (edit.end - edit.start);
	}

	return offsets;
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
 * Formats a group of comments, keeping its lines apart from the code around
 * them.
 */
function formatGroup(
	text: string,
	group: ReadonlyArray<FoundComment>,
	options: ParserOptions,
	{ fallThroughOffsets, keptStarts }: GroupContext
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

	const convert = (commentText: string, start: number) => {
		// Prettier keeps a block comment on the line of the code it follows, so
		// a converted directive after code starts a line of its own
		if (isAfterCode && formattedLines.length === 0) {
			formattedLines.push('');
		}

		conversions.push({ line: formattedLines.length, start });
		formattedLines.push(`/* ${commentText} */`);
	};

	const flushBlock = () => {
		if (block.some((line) => !EMPTY_LINE_PATTERN.test(line))) {
			formattedLines.push(
				...formatCommentBlock(block, {
					indentation,
					joinLines: true,
					printWidth: options.printWidth,
					syntax: COMMENT_SYNTAX,
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
	};

	// ESLint’s `no-fallthrough` rule only recognizes a fall-through comment when
	// it’s the last comment before a `case` or `default`, or at the end of a
	// block that forms a clause’s whole body
	const nextCodePattern = /\S/g;
	nextCodePattern.lastIndex = group.at(-1)!.end;
	const isAtFallThroughPosition = fallThroughOffsets.has(
		nextCodePattern.exec(text)?.index ?? -1
	);

	// TypeScript skips only empty lines and `//` lines between a suppression
	// and the code it covers, so keep later comments in the group as `//`
	let isAfterSuppression = isBelowSuppression(text, group[0]!.start);

	for (const [index, line] of lines.entries()) {
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

	// Joining lines can turn the last one into a fall-through comment
	const lastLine = formattedLines.at(-1) ?? '';
	const lastText = lastLine.replace(/^\/\/[ \t]*/, '');

	if (
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

		// TypeScript reads suppressions from `//` comments anywhere on a line and
		// from the last line of a block comment. For a one-line block comment after
		// code, that last line starts at `/*`
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
