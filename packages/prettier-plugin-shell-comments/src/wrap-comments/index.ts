import type { ParserOptions } from 'prettier';
import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import createCommentSyntax from '../create-comment-syntax/index.ts';
import findComments from '../find-comments/index.ts';
import isPropertyFile from '../is-property-file/index.ts';

/**
 * Wraps comments on their own lines using the print width as a target.
 */
export default async function wrapComments(
	text: string,
	options: ParserOptions
): Promise<string> {
	const lines = text.split('\n');
	const { fullLine: commentLines } = await findComments(lines, options);

	if (commentLines.size === 0) {
		return text;
	}

	// Prettier reads pragmas only from the comments and blank lines that start
	// the file
	const firstCodeIndex = lines.findIndex(
		(line) => !/^\s*(?:#.*)?$/.test(line)
	);
	const leadingEnd = firstCodeIndex === -1 ? lines.length : firstCodeIndex;
	const joinLines = !isPropertyFile(options.filepath);
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
		const block: string[] = [];

		while (
			commentLines.has(index) &&
			getIndentation(lines[index]!) === indentation
		) {
			block.push(lines[index]!.slice(indentation.length));
			index += 1;
		}

		const formattedBlock = formatCommentBlock(block, {
			indentation,
			joinLines,
			printWidth: options.printWidth,
			syntax: createCommentSyntax(isLeading),
			tabWidth: options.tabWidth,
		});

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
