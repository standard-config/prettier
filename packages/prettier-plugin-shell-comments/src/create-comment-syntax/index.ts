import type { CommentSyntax } from '@standard-config/utilities/types';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	PRAGMA_PATTERN,
} from '../constants/index.ts';

const UNSAFE_LINE_START_PATTERN =
	/^(?:#|-\*-|(?:cSpell|cspell|spell-?checker):|dotenv-linter:|pragma:|shellcheck|SPDX-|vi:|vim:|(?:bats|c8|endregion|istanbul|prettier-ignore|region|v8)$)/;

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
			NEXT_LINE_DIRECTIVE_PATTERN.test(text) ||
			(isLeading && PRAGMA_PATTERN.test(text)),
		// A directive that covers the next line stays right above that line,
		// and a comment there stays as written
		isLineKept: (texts, index) =>
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index]!) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index - 1] ?? ''),
		isUnsafeLineStart: (word) =>
			NEXT_LINE_DIRECTIVE_PATTERN.test(word) ||
			UNSAFE_LINE_START_PATTERN.test(word) ||
			(isLeading && PRAGMA_PATTERN.test(word)),
		isUnsafeParagraphStart: () => false,
		marker: '#',
	};
}
