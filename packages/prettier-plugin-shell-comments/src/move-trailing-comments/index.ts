import type { ParserOptions } from 'prettier';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	PRAGMA_PATTERN,
} from '../constants/index.ts';
import createMarkPrefix from '../create-mark-prefix/index.ts';
import findComments from '../find-comments/index.ts';
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
const MAX_REPRINTS = 3;
const SUPPRESSION_PATTERN =
	/\b(?:codespell:ignore|cspell:disable-line|gitleaks:allow|nosemgrep|NOSONAR|pragma: allowlist secret|trufflehog:ignore)\b/;

/**
 * Moves trailing comments onto their own lines, leaving the code itself
 * unchanged.
 */
export default async function moveTrailingComments(
	text: string,
	options: ParserOptions,
	reprint: (text: string) => Promise<string>
): Promise<string> {
	const lines = text.split('\n');
	const { fullLine, trailing } = await findComments(lines, options);
	const moves: Move[] = [];

	// A backslash in a comment doesn’t continue a command
	const continuesOnNextLine = (index: number) =>
		!fullLine.has(index) &&
		!trailing.has(index) &&
		CONTINUED_LINE_PATTERN.test(lines[index]!);

	for (const [index, column] of trailing) {
		const line = lines[index]!;
		const comment = line.slice(column);
		const commentText = comment.replace(/^#+[ \t]*/, '');

		// A moved suppression marker could cover different code, and a moved
		// `prettier-ignore` marker could keep a whole comment block from being
		// reflowed. A directive or pragma could start applying to the whole
		// file, and a `#!` comment could become a shebang
		if (
			comment.startsWith('#!') ||
			DIRECTIVE_PATTERN.test(commentText) ||
			IGNORE_MARKER_PATTERN.test(comment) ||
			PRAGMA_PATTERN.test(commentText) ||
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

	// A moved comment can land inside a string or heredoc and become part of
	// the code. Marked comments that survive printing without comments did,
	// so those stay where they are
	const markPrefix = createMarkPrefix(lines);
	const markedCode = await printWithoutComments(
		buildText(
			lines,
			moves,
			(move, number) => `#${markPrefix}${number}_${move.comment.slice(1)}`
		),
		options
	);

	/* v8 ignore next -- @preserve */
	if (markedCode === undefined) {
		return text;
	}

	const safeMoves = moves.filter(
		(_move, number) => !markedCode.includes(`${markPrefix}${number}_`)
	);

	if (safeMoves.length === 0) {
		return text;
	}

	const movedText = buildText(lines, safeMoves, (move) => move.comment);

	// Removed comments leave blank lines, and moving only ever adds lines that
	// aren’t blank
	const [code, movedCode] = await Promise.all([
		printWithoutComments(text, options),
		printWithoutComments(movedText, options),
	]);

	if (
		code === undefined ||
		movedCode === undefined ||
		removeBlankLines(code) !== removeBlankLines(movedCode)
	) {
		return text;
	}

	// `prettier-plugin-sh` can take more than one pass to settle the
	// indentation of a moved comment. A change in the number of `#`
	// characters can indicate duplicated or lost comment text, so keep the
	// previous result
	let result = movedText;

	for (let pass = 0; pass < MAX_REPRINTS; pass += 1) {
		const reprinted = await reprint(result);

		if (
			reprinted === result ||
			countHashes(reprinted) !== countHashes(result)
		) {
			break;
		}

		result = reprinted;
	}

	// A comment that `prettier-plugin-sh` puts back at the end of its line
	// didn’t move, and its attempted move can leave a blank line behind
	const { trailing: remainingTrailing } = await findComments(
		result.split('\n'),
		options
	);

	if (remainingTrailing.size > trailing.size - safeMoves.length) {
		return text;
	}

	return result;
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
			// comment above it
			if (
				previousLine !== undefined &&
				COMMENT_LINE_PATTERN.test(previousLine) &&
				!(movedLines.length === 1 && previousLine.startsWith('#!'))
			) {
				movedLines.push(`${getIndentation(comment)}#`);
			}

			movedLines.push(comment);
		}

		// A comment moved into a branch can also land above a comment
		if (comments.length > 0 && COMMENT_LINE_PATTERN.test(line)) {
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
