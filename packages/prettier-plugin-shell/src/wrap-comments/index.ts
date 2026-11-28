import type { ParserOptions } from 'prettier';
import { NEXT_LINE_DIRECTIVE_PATTERN } from '@standard-config/utilities/constants';
import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import { hasPhysicalNextLineSuppression } from '@standard-config/utilities/line-suppressions';
import createCommentSyntax from '../create-comment-syntax/index.ts';
import findComments, {
	isBelowNextLineDirective,
} from '../find-comments/index.ts';
import hasTrailingDirectiveMarker from '../has-trailing-directive-marker/index.ts';

/**
 * Wraps comments on their own lines using the print width as a target.
 */
export default async function wrapComments(
	text: string,
	options: ParserOptions
): Promise<string> {
	const lines = text.split('\n');
	const found = await findComments(lines, options);
	const { fullLine: commentLines } = found;

	if (commentLines.size === 0) {
		return text;
	}

	// Prettier reads pragmas only from the comments and blank lines that start
	// the file
	const firstCodeIndex = lines.findIndex(
		(line) => !/^\s*(?:#.*)?$/.test(line)
	);
	const leadingEnd = firstCodeIndex === -1 ? lines.length : firstCodeIndex;
	const outputLines: string[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index]!;

		if (!commentLines.has(index)) {
			outputLines.push(line);
			index += 1;
			continue;
		}

		const indentation = getIndentation(line);
		const isLeading = index < leadingEnd;
		const isBelowDirective = isBelowNextLineDirective(lines, index, found);
		const block: string[] = [];

		while (
			commentLines.has(index) &&
			getIndentation(lines[index]!) === indentation
		) {
			block.push(lines[index]!.slice(indentation.length));
			index += 1;
		}

		const syntax = createCommentSyntax(isLeading);
		const formattedBlock = formatCommentBlock(block, {
			indentation,
			printWidth: options.printWidth,
			// Keep the block’s first line as written when a directive on the
			// line above covers it
			syntax: isBelowDirective
				? {
						...syntax,
						isLineKept: (texts, lineIndex, lines) =>
							lineIndex === 0 ||
							syntax.isLineKept(texts, lineIndex, lines),
					}
				: syntax,
			tabWidth: options.tabWidth,
		});

		// An empty `#` line that the directive covers keeps it from covering
		// the comment below
		if (
			isBelowDirective &&
			/^#+[ \t]*$/.test(block[0]!) &&
			!/^#+[ \t]*$/.test(formattedBlock[0]!)
		) {
			formattedBlock.unshift('#');
		}

		// Keep an empty `#` line after a directive that covers the next line,
		// so the directive doesn’t start covering the code below
		const lastLine = formattedBlock.at(-1)!;

		if (
			/^#+[ \t]*$/.test(block.at(-1)!) &&
			(hasPhysicalNextLineSuppression(lastLine) ||
				NEXT_LINE_DIRECTIVE_PATTERN.test(
					lastLine.replace(/^#+[ \t]*/, '')
				))
		) {
			formattedBlock.push('#');
		}

		// Keep an empty `#` line after a PBS directive or continuation line
		// that ends in a backslash, since Torque reads the next line as part of
		// the directive
		if (
			/^#+[ \t]*$/.test(block.at(-1)!) &&
			hasTrailingDirectiveMarker(
				formattedBlock,
				formattedBlock.length - 1
			)
		) {
			formattedBlock.push('#');
		}

		outputLines.push(
			...formattedBlock.map((commentLine) => indentation + commentLine)
		);
	}

	return outputLines.join('\n');
}

/**
 * Returns the spaces and tabs at the start of a line.
 */
function getIndentation(line: string): string {
	return /^[ \t]*/.exec(line)![0];
}
