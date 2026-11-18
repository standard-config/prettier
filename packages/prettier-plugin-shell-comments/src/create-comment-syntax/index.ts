import type { CommentSyntax } from '@standard-config/utilities/types';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	PRAGMA_PATTERN,
} from '../constants/index.ts';

const UNSAFE_LINE_START_PATTERN =
	/^(?:#|-\*-|dotenv-linter:|shellcheck|SPDX-|vi:|vim:|(?:bats|endregion|prettier-ignore|region)$)/;

/**
 * Returns the syntax of shell comments, where pragmas count as directives
 * only in the comments that start the file.
 */
export default function createCommentSyntax(isLeading: boolean): CommentSyntax {
	return {
		// Keep blocks with a `#!` line as written in case they hold license
		// text, as with JavaScript’s `/*! */` comments
		isBlockKept: (line) =>
			line.startsWith('#!') || IGNORE_MARKER_PATTERN.test(line),
		isDirective: (text) =>
			DIRECTIVE_PATTERN.test(text) ||
			(isLeading && PRAGMA_PATTERN.test(text)),
		isLineKept: () => false,
		isUnsafeLineStart: (word) =>
			UNSAFE_LINE_START_PATTERN.test(word) ||
			(isLeading && PRAGMA_PATTERN.test(word)),
		marker: '#',
	};
}
