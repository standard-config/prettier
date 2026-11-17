import type { Doc, Plugin } from 'prettier';
import type { PluginOptions } from './types/index.d.ts';
import * as pluginSh from 'prettier-plugin-sh';
import wrapComments from './wrap-comments/index.ts';

const { parsers: shParsers, printers: shPrinters } = pluginSh;

/**
 * Prints shell code with `prettier-plugin-sh`, then wraps its comments unless
 * `shellWrapComments` is disabled.
 */
async function printWithWrappedComments(
	...[path, options, print, args]: Parameters<typeof shPrinters.sh.print>
): Promise<Doc> {
	// `prettier-plugin-sh` prints asynchronously despite its `Doc` return type
	const printed = await (shPrinters.sh.print(path, options, print, args) as
		Doc | Promise<Doc>);

	return typeof printed === 'string' &&
		(options as PluginOptions).shellWrapComments !== false
		? wrapComments(printed, options)
		: printed;
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
	shellWrapComments: {
		category: 'Shell',
		description: 'Reflow comments that occupy their own lines.',
		type: 'boolean',
		default: true,
	},
};

export type { PluginOptions };
