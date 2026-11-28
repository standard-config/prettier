import type { CommentSyntax } from '@standard-config/utilities/types';
import {
	GITLEAKS_ALLOW_MARKER,
	NEXT_LINE_DIRECTIVE_PATTERN,
} from '@standard-config/utilities/constants';
import {
	hasPhysicalLineSuppression,
	hasPhysicalNextLineSuppression,
} from '@standard-config/utilities/line-suppressions';
import {
	BLOCK_DIRECTIVE_PATTERN,
	CONFIGURATION_COMMENT_PATTERN,
	COVERAGE_RANGE_PATTERN,
	LINE_DIRECTIVE_PATTERN,
	TYPESCRIPT_DIRECTIVE_PATTERN,
	UNFINISHED_SETTING_PATTERN,
} from '../constants/index.ts';

const UNSAFE_LINE_START_PATTERN = /^(?:[#@]|c8|eslint|istanbul|pragma:|v8)$/;

/**
 * Returns the syntax of `//` comments.
 */
export default function createCommentSyntax(): CommentSyntax {
	return {
		hasLineSensitiveMarker: (line) =>
			hasLineSensitiveMarker(line) || hasLineSuppression(line),
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
		isLineKept: (texts, index, lines) =>
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index]!) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(texts[index - 1] ?? '') ||
			hasPhysicalNextLineSuppression(lines[index - 1] ?? ''),
		isUnsafeLineStart: (word) =>
			BLOCK_DIRECTIVE_PATTERN.test(word) ||
			LINE_DIRECTIVE_PATTERN.test(word) ||
			NEXT_LINE_DIRECTIVE_PATTERN.test(word) ||
			hasPhysicalLineSuppression(`// ${word}`) ||
			TYPESCRIPT_DIRECTIVE_PATTERN.test(word) ||
			UNSAFE_LINE_START_PATTERN.test(word) ||
			hasSonarMarker(word),
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
		isUnsafeReflow: (lines) =>
			lines.some(
				(line) =>
					COVERAGE_RANGE_PATTERN.test(line) ||
					hasLineSuppression(line)
			),
		marker: '//',
	};
}

/**
 * Checks whether a `//` comment carries a suppression tied to its line.
 */
export function hasLineSuppression(comment: string): boolean {
	return (
		hasPhysicalLineSuppression(comment) || hasSonarMarker(comment.slice(2))
	);
}

/**
 * Checks the start of the raw comment body for SonarJS’s `NOSONAR` marker.
 */
export function hasSonarMarker(body: string): boolean {
	return body
		.replace(/^\*/, '')
		.trimStart()
		.toUpperCase()
		.startsWith('NOSONAR');
}

/**
 * Checks for a Gitleaks suppression or a coverage range marker.
 */
export function hasLineSensitiveMarker(text: string): boolean {
	return (
		text.includes(GITLEAKS_ALLOW_MARKER) ||
		COVERAGE_RANGE_PATTERN.test(text)
	);
}
