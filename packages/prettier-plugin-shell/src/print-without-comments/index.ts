import type { ParserOptions } from 'prettier';
import { processor } from 'sh-syntax';

/**
 * Prints shell code without comments, or returns `undefined` if printing fails.
 */
export default async function printWithoutComments(
	text: string,
	options: ParserOptions
): Promise<string | undefined> {
	// Like Prettier, print nothing for text that holds only whitespace
	if (text.trim() === '') {
		return '';
	}

	try {
		return await processor(text, {
			filepath: options.filepath,
			keepComments: false,
			print: true,
			variant: options.variant as number | undefined,
		});
	} catch {
		return undefined;
	}
}
