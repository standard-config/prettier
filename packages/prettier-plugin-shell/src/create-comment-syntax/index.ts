import type { CommentSyntax } from '@standard-config/utilities/types';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	PRAGMA_PATTERN,
	SCHEDULER_DIRECTIVE_PATTERN,
} from '../constants/index.ts';
import continuesPbsDirective from '../continues-pbs-directive/index.ts';

// The scheduler entries match a scheduler name or `$` that the next word could
// complete into a directive, and words that already start one, such as `$-cwd`,
// `SBATCH--time`, or `flux:`
const UNSAFE_LINE_START_PATTERN =
	/^(?:#|\$-[A-Za-z]|-\*-|(?:BSUB|PBS|SBATCH)["']?-|(?:cSpell|cspell|spell-?checker):|dotenv-linter:|(?:flux|FLUX):|pragma:|shellcheck|SPDX-|vi:|vim:|(?:\$|bats|BSUB|c8|endregion|istanbul|PBS|prettier-ignore|region|SBATCH|v8)$)/;

/**
 * Returns the syntax of shell comments, where pragmas count as directives only
 * in the comments that start the file.
 */
export default function createCommentSyntax(isLeading: boolean): CommentSyntax {
	return {
		// Keep blocks with a `#!` line as written in case they hold license
		// text, as with JavaScript’s `/*! */` comments
		isBlockKept: (line) =>
			line.startsWith('#!') || IGNORE_MARKER_PATTERN.test(line),
		isDirective: (text) =>
			DIRECTIVE_PATTERN.test(text) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(text) ||
			SCHEDULER_DIRECTIVE_PATTERN.test(text) ||
			(isLeading && PRAGMA_PATTERN.test(text)),
		// A directive that covers the next line stays right above that line,
		// and a comment there stays as written. Scheduler directives stay as
		// written without empty lines around them, since they often sit in
		// groups below short comments
		isLineKept: (texts, index) =>
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index]!) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index - 1] ?? '') ||
			isSchedulerDirectiveLine(texts, index),
		isUnsafeLineStart: (word) =>
			NEXT_LINE_DIRECTIVE_PATTERN.test(word) ||
			UNSAFE_LINE_START_PATTERN.test(word) ||
			(isLeading && PRAGMA_PATTERN.test(word)),
		isUnsafeParagraphStart: () => false,
		marker: '#',
	};
}

/**
 * Checks whether a line holds a scheduler directive or continues a PBS
 * directive.
 */
export function isSchedulerDirectiveLine(
	lines: ReadonlyArray<string>,
	index: number
): boolean {
	return (
		SCHEDULER_DIRECTIVE_PATTERN.test(lines[index]!) ||
		continuesPbsDirective(lines, index - 1)
	);
}
