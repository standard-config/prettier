import type { ParserOptions } from 'prettier';
import type { FoundComment, FoundComments } from '../find-comments/index.ts';
import type { CommentEdit, TextRange } from '../types/index.d.ts';
import {
	NEXT_LINE_DIRECTIVE_PATTERN,
	SUPPRESSION_PATTERN,
} from '@standard-config/utilities/constants';
import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import {
	BLOCK_DIRECTIVE_PATTERN,
	CONTINUED_DIRECTIVE_PATTERN,
	FALL_THROUGH_PATTERN,
	INDENTED_LINE_PATTERN,
	LINE_DIRECTIVE_PATTERN,
	LIST_DIRECTIVE_PATTERN,
	TYPESCRIPT_DIRECTIVE_PATTERN,
	TYPESCRIPT_SUPPRESSION_PATTERN,
	UNFINISHED_SETTING_PATTERN,
} from '../constants/index.ts';
import createCommentSyntax from '../create-comment-syntax/index.ts';

type MoveContext = {
	/**
	 * Indentation at which comments that move to another line print, by the
	 * offsets of the original comments.
	 */
	indentations: ReadonlyMap<number, string>;
	/**
	 * Offsets of trailing directives that stay `//` comments.
	 */
	keptStarts: ReadonlySet<number>;
};

/**
 * Moves eligible trailing `//` comments above the code they follow. Converts
 * supported suppressions and directives to block comments on the same line,
 * except those whose offsets are kept. Comments that move to another line use
 * the indentation measured for them, if any.
 */
export default function moveTrailingComments(
	text: string,
	found: FoundComments,
	options: ParserOptions,
	{ indentations, keptStarts }: MoveContext
): CommentEdit[] {
	const { comments, fallThroughOffsets, textRanges } = found;
	const edits: CommentEdit[] = [];
	const syntax = createCommentSyntax();

	const movedTargets = new Set<number>();

	for (const comment of comments) {
		const lineStart = text.lastIndexOf('\n', comment.start - 1) + 1;
		const code = text.slice(lineStart, comment.start);
		const codeStart = lineStart + /^[ \t]*/.exec(code)![0].length;
		const commentText = text.slice(comment.start, comment.end).trimEnd();
		const directive = commentText.replace(/^\/+[ \t]*/, '');

		if (
			!comment.isTrailing ||
			code.trim() === '' ||
			!commentText.startsWith('//') ||
			keptStarts.has(comment.start) ||
			syntax.isBlockKept(commentText) ||
			isInsideText(codeStart, textRanges)
		) {
			continue;
		}

		// ESLint’s `no-fallthrough` rule recognizes a fall-through comment only
		// when it’s the last comment before a `case` or `default`, or at the
		// end of a block that forms a clause’s whole body
		const nextCodePattern = /\S/g;
		nextCodePattern.lastIndex = comment.end;
		const isFallThrough =
			FALL_THROUGH_PATTERN.test(directive) &&
			fallThroughOffsets.has(nextCodePattern.exec(text)?.index ?? -1);

		// A moved suppression could cover different code, and a moved directive
		// could start applying to the code around it
		if (
			BLOCK_DIRECTIVE_PATTERN.test(directive) ||
			isFallThrough ||
			SUPPRESSION_PATTERN.test(directive)
		) {
			// A list continues only if a `//` comment follows on the next line.
			// Converting only this line would apply part of the setting
			const nextCommentPattern = /[ \t]*\n[ \t]*(\/\/.*)/y;
			nextCommentPattern.lastIndex = comment.end;
			const [, nextLine] = nextCommentPattern.exec(text) ?? [];
			const continuesBelow =
				nextLine !== undefined && isContinuedList(directive, nextLine);

			// Only convert directives that follow exactly two slashes
			if (
				/^\/\/(?!\/)/.test(commentText) &&
				!continuesBelow &&
				!directive.includes('*/')
			) {
				edits.push({
					conversions: [
						{ isTrailing: true, line: 0, start: comment.start },
					],
					end: comment.end,
					start: comment.start,
					text: `/* ${directive} */`,
				});
			}

			continue;
		}

		// Empty comments and directives that only work in `//` comments or
		// cover the next line stay in place, as do unfinished rule settings,
		// which could continue below
		if (
			directive === '' ||
			LINE_DIRECTIVE_PATTERN.test(directive) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(directive) ||
			TYPESCRIPT_DIRECTIVE_PATTERN.test(directive) ||
			UNFINISHED_SETTING_PATTERN.test(directive)
		) {
			continue;
		}

		let [targetLineStart, targetCodeStart] = findTargetLine(
			text,
			codeStart,
			found
		);

		const isRelocated = targetLineStart !== lineStart;

		// Prettier can rewrite the lines around a comment that moves to another
		// line, so place the comment above any directive covering the target
		// line and any comments grouped with that directive
		let commentAbove = isRelocated
			? findDirectiveAbove(text, targetLineStart, found)
			: undefined;

		while (commentAbove) {
			const lineAboveStart =
				text.lastIndexOf('\n', commentAbove.start - 1) + 1;

			// The line above can continue JSX text too
			[targetLineStart, targetCodeStart] = findTargetLine(
				text,
				lineAboveStart +
					/^[ \t]*/.exec(text.slice(lineAboveStart))![0].length,
				found
			);
			commentAbove =
				findDirectiveAbove(text, targetLineStart, found) ??
				findOwnLineCommentAbove(text, targetLineStart, found);
		}

		// ESLint’s `no-fallthrough` checks only the last comment before `case`
		// or `default`, or before the closing brace when a block forms the
		// whole clause body. Moving a fall-through comment there would silence
		// the rule. Moving another comment there could hide an existing
		// fall-through comment
		if (
			isInsideText(targetCodeStart, textRanges) ||
			findDirectiveAbove(text, targetLineStart, found) !== undefined ||
			(fallThroughOffsets.has(targetCodeStart) &&
				(FALL_THROUGH_PATTERN.test(directive) ||
					isAfterFallThrough(text, targetCodeStart, found)))
		) {
			continue;
		}

		// Reflow uses the indentation measured where the comment prints, if
		// any. Otherwise, use a different target line’s source indentation, or
		// add an indent before a closing delimiter on the original line
		const measuredIndentation = indentations.get(comment.start);
		let indentation = measuredIndentation ?? comment.indentation;

		if (measuredIndentation === undefined && isRelocated) {
			indentation = text.slice(targetLineStart, targetCodeStart);
		} else if (
			measuredIndentation === undefined &&
			/^[)\]}]/.test(text.slice(targetCodeStart))
		) {
			indentation += options.useTabs
				? '\t'
				: ' '.repeat(options.tabWidth);
		}

		const movedLines = formatCommentBlock([commentText], {
			indentation,
			printWidth: options.printWidth,
			syntax,
			tabWidth: options.tabWidth,
		});

		// An empty `//` line keeps a moved comment apart from the one moved
		// above the same line before it
		const isAfterComment = movedTargets.has(targetCodeStart);

		if (isAfterComment) {
			movedLines.unshift('//');
		}

		movedTargets.add(targetCodeStart);

		const linePrefix = text.slice(targetLineStart, targetCodeStart);

		edits.push(
			{
				conversions: [],
				end: targetCodeStart,
				movedLine: isAfterComment ? 1 : 0,
				source: { end: comment.end, start: comment.start },
				start: targetCodeStart,
				text: `${movedLines.join(`\n${linePrefix}`)}\n${linePrefix}`,
			},
			{
				conversions: [],
				end: comment.end,
				start: lineStart + code.trimEnd().length,
				text: '',
			}
		);
	}

	return edits;
}

/**
 * Finds where to insert a moved comment without turning it into JSX text.
 * Returns the start of the target line and the offset where its code begins.
 */
function findTargetLine(
	text: string,
	codeStart: number,
	{ jsxElementRanges, jsxTextRanges }: FoundComments
): [number, number] {
	let lineStart = text.lastIndexOf('\n', codeStart - 1) + 1;
	let targetStart = codeStart;
	let textRange = findRange(targetStart, jsxTextRanges);

	while (textRange) {
		const element = findJsxElement(textRange, jsxElementRanges);

		lineStart = text.lastIndexOf('\n', element.start - 1) + 1;
		targetStart =
			lineStart + /^[ \t]*/.exec(text.slice(lineStart))![0].length;
		textRange = findRange(targetStart, jsxTextRanges);
	}

	return [lineStart, targetStart];
}

/**
 * Returns the innermost JSX element or fragment that holds a range of JSX text.
 */
function findJsxElement(
	range: TextRange,
	elements: ReadonlyArray<TextRange>
): TextRange {
	// JSX text always sits inside an element or a fragment
	return elements
		.filter(
			(element) => element.start < range.start && range.end <= element.end
		)
		.toSorted((a, b) => b.start - a.start)[0]!;
}

/**
 * Returns the range that an offset falls inside or at the end of.
 */
function findRange(
	offset: number,
	ranges: ReadonlyArray<TextRange>
): TextRange | undefined {
	return ranges.find(({ end, start }) => start < offset && offset <= end);
}

/**
 * Checks whether a directive’s list continues on the next `//` line.
 */
export function isContinuedList(text: string, nextLine: string): boolean {
	return (
		BLOCK_DIRECTIVE_PATTERN.test(text) &&
		LIST_DIRECTIVE_PATTERN.test(text) &&
		// ESLint ends the list where a `--` description starts
		!/\s-{2,}\s/.test(text) &&
		(CONTINUED_DIRECTIVE_PATTERN.test(text) ||
			hasOpenBracket(text) ||
			INDENTED_LINE_PATTERN.test(nextLine))
	);
}

/**
 * Returns whether text opens more brackets than it closes, outside quotes.
 */
function hasOpenBracket(text: string): boolean {
	let depth = 0;
	let quote: string | undefined;

	for (const character of text) {
		if (quote) {
			quote = character === quote ? undefined : quote;
		} else if (character === '"' || character === "'") {
			quote = character;
		} else if (character === '[' || character === '{') {
			depth += 1;
		} else if (character === ']' || character === '}') {
			depth -= 1;
		}
	}

	return depth > 0;
}

/**
 * Returns a comment’s text without its markers.
 */
export function getCommentText(comment: string): string {
	return comment
		.trim()
		.replace(/^\/\*+\s*|^\/+[ \t]*/, '')
		.replace(/\s*\*\/$/, '');
}

/**
 * Returns all comment ranges, including inline block comments.
 */
function getAllComments(
	text: string,
	{ comments, textRanges }: FoundComments
): TextRange[] {
	return [
		...comments,
		...textRanges.filter(({ start }) => text.startsWith('/*', start)),
	];
}

/**
 * Returns the previous line’s starting offset, or `0` on the first line.
 */
function getPreviousLineStart(text: string, lineStart: number): number {
	// `lastIndexOf` treats a negative position as `0`, so it would find the
	// newline at offset `0` again
	return lineStart > 1 ? text.lastIndexOf('\n', lineStart - 2) + 1 : 0;
}

/**
 * Returns a comment ending on the previous line that holds a directive covering
 * the line below it, which a moved comment could separate from its code.
 */
export function findDirectiveAbove(
	text: string,
	lineStart: number,
	found: FoundComments
): TextRange | undefined {
	const previousLineStart = getPreviousLineStart(text, lineStart);

	return getAllComments(text, found).find(
		({ end, start }) =>
			end >= previousLineStart &&
			end < lineStart &&
			isNextLineDirective(text.slice(start, end))
	);
}

/**
 * Returns a `//` comment that Prettier prints on a line of its own and that
 * ends on the line before the one that starts at an offset.
 */
function findOwnLineCommentAbove(
	text: string,
	lineStart: number,
	{ comments }: FoundComments
): FoundComment | undefined {
	const previousLineStart = getPreviousLineStart(text, lineStart);

	return comments.find(
		({ end, isTrailing, start }) =>
			!isTrailing &&
			text.startsWith('//', start) &&
			end >= previousLineStart &&
			end < lineStart
	);
}

/**
 * Returns whether a fall-through comment comes right before an offset, with
 * only whitespace in between.
 */
function isAfterFallThrough(
	text: string,
	offset: number,
	found: FoundComments
): boolean {
	let index = offset;

	while (index > 0 && /\s/.test(text[index - 1]!)) {
		index -= 1;
	}

	return getAllComments(text, found).some(
		({ end, start }) =>
			start < index &&
			index <= end &&
			FALL_THROUGH_PATTERN.test(text.slice(start, end))
	);
}

/**
 * Returns whether a comment holds a directive that covers the line below it.
 */
function isNextLineDirective(comment: string): boolean {
	const commentText = getCommentText(comment);

	return (
		FALL_THROUGH_PATTERN.test(commentText) ||
		NEXT_LINE_DIRECTIVE_PATTERN.test(commentText) ||
		TYPESCRIPT_SUPPRESSION_PATTERN.test(commentText)
	);
}

/**
 * Returns whether an offset falls inside or at the end of a string, template
 * text, or block comment.
 */
function isInsideText(
	offset: number,
	ranges: ReadonlyArray<TextRange>
): boolean {
	return findRange(offset, ranges) !== undefined;
}
