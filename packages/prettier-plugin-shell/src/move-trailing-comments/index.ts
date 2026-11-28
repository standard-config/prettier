import type { ParserOptions } from 'prettier';
import {
	GITLEAKS_ALLOW_MARKER,
	NEXT_LINE_DIRECTIVE_PATTERN,
	SUPPRESSION_PATTERN,
} from '@standard-config/utilities/constants';
import createMarkPrefix from '@standard-config/utilities/create-mark-prefix';
import {
	hasPhysicalLineSuppression,
	hasPhysicalNextLineSuppression,
} from '@standard-config/utilities/line-suppressions';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	MARK_PREFIX,
	PRAGMA_PATTERN,
	SCHEDULER_DIRECTIVE_PATTERN,
} from '../constants/index.ts';
import { isSchedulerDirectiveLine } from '../create-comment-syntax/index.ts';
import findComments, {
	isBelowNextLineDirective,
} from '../find-comments/index.ts';
import hasTrailingDirectiveMarker from '../has-trailing-directive-marker/index.ts';
import printWithoutComments from '../print-without-comments/index.ts';

type Move = {
	code: string;
	comment: string;
	indentation: string;
	index: number;
	target: number;
};

const BRANCH_LINE_PATTERN = /^(?:elif[ \t].*;[ \t]*then|else)$/;
const CLOSING_LINE_PATTERN = /^(?:\)|(?:done|esac|fi|\})(?=$|[\t ;&|()<>]))/;
const COMMENT_LINE_PATTERN = /^[ \t]*#/;
const CONTINUED_LINE_PATTERN = /(?<!\\)(?:\\\\)*(?:&&|\\|\|\|?)$/;
const CONTINUING_LINE_PATTERN = /^[ \t]*(?:&&|\|\|)/;
const MAX_REPRINTS = 3;

/**
 * Moves trailing comments onto their own lines without changing the code.
 */
export default async function moveTrailingComments(
	text: string,
	options: ParserOptions,
	reprint: (text: string) => Promise<string>
): Promise<string> {
	const lines = text.split('\n');
	const found = await findComments(lines, options);
	const { fullLine, trailing } = found;
	const moves: Move[] = [];

	// A backslash in a comment doesn’t continue a command. In test and
	// arithmetic expressions, `sh-syntax` starts continued lines with `&&` or
	// `||` instead
	const continuesOnNextLine = (index: number) =>
		(!fullLine.has(index) &&
			!trailing.has(index) &&
			CONTINUED_LINE_PATTERN.test(lines[index]!)) ||
		CONTINUING_LINE_PATTERN.test(lines[index + 1]!);

	for (const [index, column] of trailing) {
		const line = lines[index]!;
		const comment = line.slice(column);
		const commentText = comment.replace(/^#+[ \t]*/, '');

		// Moving a suppression or next-line directive could change which code
		// it covers. Moving `prettier-ignore` could prevent an entire comment
		// block from reflowing. A pragma or directive could take effect across
		// the file, and `#!` could become a shebang. Bats recognizes `@test`
		// only at the end of the function’s opening line
		if (
			comment.startsWith('#!') ||
			commentText === '@test' ||
			DIRECTIVE_PATTERN.test(commentText) ||
			comment.includes(GITLEAKS_ALLOW_MARKER) ||
			IGNORE_MARKER_PATTERN.test(comment) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(commentText) ||
			PRAGMA_PATTERN.test(comment.slice(1).trim()) ||
			SCHEDULER_DIRECTIVE_PATTERN.test(commentText) ||
			hasPhysicalLineSuppression(comment) ||
			hasPhysicalLineSuppression(line) ||
			hasPhysicalNextLineSuppression(lines[index - 1] ?? '') ||
			SUPPRESSION_PATTERN.test(comment)
		) {
			continue;
		}

		const code = line.slice(0, column).trimEnd();
		let target = index;

		// Keep moved comments outside the whole command, since a comment line
		// would break a `\` continuation
		while (target > 0 && continuesOnNextLine(target - 1)) {
			target -= 1;
		}

		const command = [...lines.slice(target, index), code]
			.map((commandLine) => commandLine.trim())
			.join(' ');

		// A comment on an `elif` or `else` line describes the branch it opens
		if (BRANCH_LINE_PATTERN.test(command)) {
			moves.push({
				code,
				comment,
				indentation: getBodyIndentation(
					lines[target]!,
					lines
						.values()
						.drop(index + 1)
						.find((line) => line.trim() !== '')!,
					options
				),
				index,
				target: index + 1,
			});
			continue;
		}

		// A comment moved below a directive that covers the next line would
		// take that line’s place, and one moved below a PBS directive that ends
		// in a backslash would continue the directive
		if (
			isBelowNextLineDirective(lines, target, found) ||
			hasTrailingDirectiveMarker(lines, target - 1)
		) {
			continue;
		}

		moves.push({
			code,
			comment,
			indentation:
				target === index && CLOSING_LINE_PATTERN.test(code.trimStart())
					? getBodyIndentation(
							line,
							lines
								.slice(0, index)
								.findLast((line) => line.trim() !== '')!,
							options
						)
					: getIndentation(lines[target]!),
			index,
			target,
		});
	}

	if (moves.length === 0) {
		return text;
	}

	const markPrefix = createMarkPrefix(lines.join('\n'), MARK_PREFIX);
	let codePromise: Promise<string | undefined> | undefined;

	// Returns the text with the moves applied, or `undefined` when they can’t
	// be validated together
	const applyMoves = async (
		candidates: ReadonlyArray<Move>
	): Promise<string | undefined> => {
		// A moved comment can land inside a string or heredoc and become part
		// of the code. Marked comments that survive printing without comments
		// did, so those stay where they are
		const markedCode = await printWithoutComments(
			buildText(
				lines,
				candidates,
				(move, number) =>
					`#${markPrefix}${number}_${move.comment.slice(1)}`
			),
			options
		);

		if (markedCode === undefined) {
			return undefined;
		}

		const safeMoves = candidates.filter(
			(_move, number) => !markedCode.includes(`${markPrefix}${number}_`)
		);

		if (safeMoves.length === 0) {
			return undefined;
		}

		const movedText = buildText(lines, safeMoves, (move) => move.comment);

		// Removed comments leave blank lines, and moving only ever adds lines
		// that aren’t blank
		codePromise ??= printWithoutComments(text, options);
		const [code, movedCode] = await Promise.all([
			codePromise,
			printWithoutComments(movedText, options),
		]);

		if (
			code === undefined ||
			movedCode === undefined ||
			removeBlankLines(code) !== removeBlankLines(movedCode)
		) {
			return undefined;
		}

		// `sh-syntax` can take more than one pass to settle the indentation of
		// a moved comment. A change in the number of `#` characters can
		// indicate duplicated or lost text, so reject that set of moves
		let result = movedText;

		for (let pass = 0; pass < MAX_REPRINTS; pass += 1) {
			const reprinted = await reprint(result);

			if (reprinted === result) {
				break;
			}

			if (countHashes(reprinted) !== countHashes(result)) {
				return undefined;
			}

			result = reprinted;
		}

		// A comment that `sh-syntax` puts back at the end of its line didn’t
		// move, and its attempted move can leave a blank line behind
		const { trailing: remainingTrailing } = await findComments(
			result.split('\n'),
			options
		);

		if (remainingTrailing.size > trailing.size - safeMoves.length) {
			return undefined;
		}

		return result;
	};

	// Narrows down the moves that can’t be validated by halves, so that a few
	// of them cost a few validations each rather than one per comment
	const findValidMoves = async (
		candidates: ReadonlyArray<Move>,
		isInvalid = false
	): Promise<Move[]> => {
		if (!isInvalid && (await applyMoves(candidates)) !== undefined) {
			return [...candidates];
		}

		if (candidates.length === 1) {
			return [];
		}

		const middle = Math.ceil(candidates.length / 2);
		const firstMoves = await findValidMoves(candidates.slice(0, middle));

		// When the first half passes, the moves that failed together are in the
		// second half
		const secondMoves = await findValidMoves(
			candidates.slice(middle),
			firstMoves.length === middle
		);

		return [...firstMoves, ...secondMoves];
	};

	const result = await applyMoves(moves);

	if (result !== undefined || moves.length === 1) {
		return result ?? text;
	}

	// A move that can’t be validated, such as one into an arithmetic
	// expression, stays out without keeping the other comments in place
	const validMoves = await findValidMoves(moves, true);

	if (validMoves.length === 0) {
		return text;
	}

	return (await applyMoves(validMoves)) ?? text;
}

/**
 * Applies moves to the lines, placing each comment above its target line.
 */
function buildText(
	lines: ReadonlyArray<string>,
	moves: ReadonlyArray<Move>,
	renderComment: (move: Move, number: number) => string
): string {
	const codeLines = [...lines];

	for (const move of moves) {
		codeLines[move.index] = move.code;
	}

	const movesByTarget = Map.groupBy(
		moves.entries(),
		([, move]) => move.target
	);
	const movedLines: string[] = [];

	for (const [index, line] of codeLines.entries()) {
		const comments = (movesByTarget.get(index) ?? []).map(
			([number, move]) => move.indentation + renderComment(move, number)
		);

		for (const comment of comments) {
			const previousLine = movedLines.at(-1);

			// An empty comment line keeps a moved comment from joining the
			// comment above it. Scheduler directives and the lines that
			// continue them never join
			if (
				previousLine !== undefined &&
				COMMENT_LINE_PATTERN.test(previousLine) &&
				!isSchedulerDirectiveLine(movedLines, movedLines.length - 1)
			) {
				movedLines.push(`${getIndentation(comment)}#`);
			}

			movedLines.push(comment);
		}

		// A comment moved into a branch can also land above a comment, which
		// needs the same separation unless it’s a scheduler directive
		if (
			comments.length > 0 &&
			COMMENT_LINE_PATTERN.test(line) &&
			!isSchedulerDirectiveLine(codeLines, index)
		) {
			movedLines.push(`${getIndentation(line)}#`);
		}

		movedLines.push(line);
	}

	return movedLines.join('\n');
}

/**
 * Counts the `#` characters in text.
 */
function countHashes(text: string): number {
	return text.split('#').length - 1;
}

/**
 * Returns the indentation of the block body that a line such as `done` or
 * `else` ends or opens, given the nearest non-blank line of that body.
 */
function getBodyIndentation(
	line: string,
	bodyLine: string,
	{ tabWidth, useTabs }: ParserOptions
): string {
	const indentation = getIndentation(line);
	const bodyIndentation = getIndentation(bodyLine);

	if (bodyIndentation.length > indentation.length) {
		return bodyIndentation;
	}

	return indentation + (useTabs ? '\t' : ' '.repeat(tabWidth));
}

/**
 * Returns the spaces and tabs at the start of a line.
 */
function getIndentation(line: string): string {
	return /^[ \t]*/.exec(line)![0];
}

/**
 * Removes the blank lines from text.
 */
function removeBlankLines(text: string): string {
	return text
		.split('\n')
		.filter((line) => line.trim() !== '')
		.join('\n');
}
