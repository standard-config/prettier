import type { Doc, Plugin } from 'prettier';
import type { PluginOptions } from './types/index.d.ts';
import * as pluginSh from 'prettier-plugin-sh';
import isPropertyFile from './is-property-file/index.ts';
import moveTrailingComments from './move-trailing-comments/index.ts';
import wrapComments from './wrap-comments/index.ts';

const { parsers: shParsers, printers: shPrinters } = pluginSh;

/**
 * Prints shell code with `prettier-plugin-sh`, then wraps its comments as
 * `shellCommentWrap` selects.
 */
async function printWithWrappedComments(
	...[path, options, print, args]: Parameters<typeof shPrinters.sh.print>
): Promise<Doc> {
	// `prettier-plugin-sh` prints asynchronously despite its `Doc` return type
	const printed = await (shPrinters.sh.print(path, options, print, args) as
		Doc | Promise<Doc>);

	const commentWrap = (options as PluginOptions).shellCommentWrap ?? 'all';

	if (typeof printed !== 'string' || commentWrap === 'none') {
		return printed;
	}

	const reprint = async (text: string): Promise<string> => {
		const reprinted = await (shPrinters.sh.print(
			path,
			{ ...options, originalText: text },
			print,
			args
		) as Doc | Promise<Doc>);

		return typeof reprinted === 'string' ? reprinted : text;
	};

	// A `#` after an entry in a data file can belong to the entry itself
	const text =
		commentWrap === 'all' && !isPropertyFile(options.filepath)
			? await moveTrailingComments(printed, options, reprint)
			: printed;

	return wrapComments(text, options);
}

// Prettier prints with the printer of the plugin that supplies the parser
export const parsers: Plugin['parsers'] = {
	sh: shParsers.sh,
};

export const printers: Plugin['printers'] = {
	sh: {
		...shPrinters.sh,
		// Prettier awaits the root print, which `prettier-plugin-sh` relies on too
		print: printWithWrappedComments as unknown as typeof shPrinters.sh.print,
	},
};

export const options: Plugin['options'] = {
	...pluginSh.options,
	shellCommentWrap: {
		category: 'Shell',
		description: 'Control wrapping for comments.',
		type: 'choice',
		default: 'all',
		choices: [
			{
				description:
					'Move trailing comments onto their own lines, then reflow every comment.',
				value: 'all',
			},
			{
				description: 'Reflow comments that occupy their own lines.',
				value: 'full-line',
			},
			{
				description: 'Leave all comments as written.',
				value: 'none',
			},
		],
	},
};

export type { PluginOptions };
