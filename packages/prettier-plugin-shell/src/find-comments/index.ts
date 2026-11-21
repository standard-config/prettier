import type { ParserOptions } from 'prettier';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';
import createMarkPrefix from '@standard-config/utilities/create-mark-prefix';
import { MARK_PREFIX } from '../constants/index.ts';
import printWithoutComments from '../print-without-comments/index.ts';

export type FoundComments = {
	/**
	 * Indexes of the lines that hold only a comment.
	 */
	fullLine: Set<number>;
	/**
	 * Column where the comment starts, by line index, for comments that follow
	 * code on the same line.
	 */
	trailing: Map<number, number>;
};

type Candidate = {
	column: number;
	isFullLine: boolean;
	line: number;
};

/**
 * Finds comments in printed shell code, excluding the initial shebang.
 */
export default async function findComments(
	lines: ReadonlyArray<string>,
	options: ParserOptions
): Promise<FoundComments> {
	const candidates: Candidate[] = [];

	for (const [index, line] of lines.entries()) {
		if (index === 0 && line.startsWith('#!')) {
			continue;
		}

		const fullLineMatch = /^[ \t]*#/.exec(line);

		if (fullLineMatch) {
			candidates.push({
				column: fullLineMatch[0].length - 1,
				isFullLine: true,
				line: index,
			});
		}

		// A line that starts inside a string can still end with a comment
		for (const match of line.matchAll(/(?<=[ \t])#/g)) {
			if (fullLineMatch && match.index < fullLineMatch[0].length) {
				continue;
			}

			candidates.push({
				column: match.index,
				isFullLine: false,
				line: index,
			});
		}
	}

	const foundComments: FoundComments = {
		fullLine: new Set(),
		trailing: new Map(),
	};

	if (candidates.length === 0) {
		return foundComments;
	}

	// The shell parser doesn’t expose nested comments, so mark each candidate
	// `#` and print without comments. Marks inside heredocs and strings
	// survive. Marking right after `#` keeps line endings intact
	const markPrefix = createMarkPrefix(lines.join('\n'), MARK_PREFIX);
	const markedLines = [...lines];

	// Marking from the end keeps the columns of earlier candidates valid
	for (const [number, { column, line }] of [
		...candidates.entries(),
	].toReversed()) {
		const markedLine = markedLines[line]!;
		markedLines[line] =
			`${markedLine.slice(0, column + 1)}${markPrefix}${number}_${markedLine.slice(column + 1)}`;
	}

	const markedCode = await printWithoutComments(
		markedLines.join('\n'),
		options
	);

	// A mark can change how a line parses, such as a heredoc delimiter that
	// starts with `#`, so treat every line as code
	if (markedCode === undefined) {
		return foundComments;
	}

	const markedNumbers = new Set(
		markedCode
			.matchAll(new RegExp(`${markPrefix}(\\d+)_`, 'g'))
			.map((match) => Number(match[1]))
	);

	const foundLines = new Set<number>();

	for (const [number, { column, isFullLine, line }] of candidates.entries()) {
		if (markedNumbers.has(number)) {
			continue;
		}

		// Marks after the start of a comment vanish with it, so only the first
		// vanished mark on each line counts
		if (foundLines.has(line)) {
			continue;
		}

		foundLines.add(line);

		if (isFullLine) {
			foundComments.fullLine.add(line);
		} else {
			foundComments.trailing.set(line, column);
		}
	}

	return foundComments;
}

/**
 * Returns whether the preceding line’s comment text starts with a directive
 * that covers the given line.
 */
export function isBelowNextLineDirective(
	lines: ReadonlyArray<string>,
	index: number,
	{ fullLine, trailing }: FoundComments
): boolean {
	const lineAbove = lines[index - 1] ?? '';
	const column = fullLine.has(index - 1)
		? lineAbove.indexOf('#')
		: trailing.get(index - 1);

	return (
		column !== undefined &&
		NEXT_LINE_DIRECTIVE_PATTERN.test(
			lineAbove.slice(column).replace(/^#+[ \t]*/, '')
		)
	);
}
