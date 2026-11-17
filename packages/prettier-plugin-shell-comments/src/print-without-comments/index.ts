import type { ParserOptions } from 'prettier';
import { format } from 'prettier';
import * as pluginShell from 'prettier-plugin-sh';

/**
 * Prints shell code without its comments, or returns `undefined` when the
 * code can’t be parsed.
 */
export default async function printWithoutComments(
	text: string,
	options: ParserOptions
): Promise<string | undefined> {
	try {
		return await format(text, {
			filepath: options.filepath,
			keepComments: false,
			parser: 'sh',
			plugins: [pluginShell],
			variant: options.variant,
		});
	} catch {
		return undefined;
	}
}
