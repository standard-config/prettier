import type { CommentSyntax } from '@standard-config/utilities/types';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';
import {
	BLOCK_DIRECTIVE_PATTERN,
	CONFIGURATION_COMMENT_PATTERN,
	LINE_DIRECTIVE_PATTERN,
	TYPESCRIPT_DIRECTIVE_PATTERN,
	UNFINISHED_SETTING_PATTERN,
} from '../constants/index.ts';

const UNSAFE_LINE_START_PATTERN =
	/^(?:(?:[#@]|c8|eslint|istanbul|v8)$|pragma:)/;

/**
 * Returns the syntax of `//` comments.
 */
export default function createCommentSyntax(): CommentSyntax {
	return {
		// Bundlers keep `//!` comments and those that mention `@license` or
		// `@preserve` as legal comments
		isBlockKept: (line) =>
			line.startsWith('//!') || /@(?:license|preserve)\b/.test(line),
		// ESLint ignores its configuration comments in `//` comments, so a line
		// starting with `global` can join the prose above
		isDirective: (text) =>
			(BLOCK_DIRECTIVE_PATTERN.test(text) &&
				!CONFIGURATION_COMMENT_PATTERN.test(text)) ||
			LINE_DIRECTIVE_PATTERN.test(text) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(text) ||
			TYPESCRIPT_DIRECTIVE_PATTERN.test(text),
		// A directive that covers the next line stays right above that line,
		// and a comment there stays as written
		isLineKept: (texts, index) =>
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index]!) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index - 1] ?? ''),
		isUnsafeLineStart: (word) =>
			BLOCK_DIRECTIVE_PATTERN.test(word) ||
			LINE_DIRECTIVE_PATTERN.test(word) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(word) ||
			TYPESCRIPT_DIRECTIVE_PATTERN.test(word) ||
			UNSAFE_LINE_START_PATTERN.test(word),
		// Reflow can complete an unfinished ESLint setting or strip extra
		// slashes from a configuration comment. Keep the paragraph’s opening
		// line as written so the next run can’t convert it to a block comment
		isUnsafeParagraphStart: (line) => {
			const text = line.replace(/^\/+[ \t]*/, '');

			return (
				(line.startsWith('///') &&
					BLOCK_DIRECTIVE_PATTERN.test(text) &&
					CONFIGURATION_COMMENT_PATTERN.test(text)) ||
				UNFINISHED_SETTING_PATTERN.test(text)
			);
		},
		marker: '//',
	};
}
