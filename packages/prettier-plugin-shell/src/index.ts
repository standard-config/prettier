import type { Doc, ParserOptions, Plugin } from 'prettier';
import type { PluginOptions } from './types/index.d.ts';
import * as pluginSh from 'prettier-plugin-sh';
import isPropertyFile from './is-property-file/index.ts';
import moveTrailingComments from './move-trailing-comments/index.ts';
import wrapComments from './wrap-comments/index.ts';

const { parsers: shParsers, printers: shPrinters } = pluginSh;

type DockerfilePrint = typeof shPrinters.dockerfile.print;
type ShPrint = typeof shPrinters.sh.print;

/**
 * Returns the options that `prettier-plugin-sh` prints with, which take their
 * indentation from `shTabWidth` and `shUseTabs` rather than Prettier’s own
 * options.
 */
function getShOptions<T>(
	options: ParserOptions<T>,
	simplify: boolean
): ParserOptions<T> {
	const { shTabWidth, shUseTabs } = options as ParserOptions<T> &
		PluginOptions;

	return { ...options, simplify, tabWidth: shTabWidth!, useTabs: shUseTabs! };
}

/**
 * Prints shell code with `prettier-plugin-sh`, then wraps its comments as
 * `shCommentWrap` selects.
 */
async function printWithWrappedComments(
	...[path, options, print, args]: Parameters<ShPrint>
): Promise<Doc> {
	// Simplifying data files could change the values they hold
	const shOptions = getShOptions(options, !isPropertyFile(options.filepath));

	// `prettier-plugin-sh` prints asynchronously despite its `Doc` return type
	const printed = await (shPrinters.sh.print(path, shOptions, print, args) as
		Doc | Promise<Doc>);

	const { shCommentWrap } = options as PluginOptions;

	if (typeof printed !== 'string' || shCommentWrap === 'none') {
		return printed;
	}

	// Code that printed as a string reprints as one
	const reprint = async (text: string) =>
		(await (shPrinters.sh.print(
			path,
			{ ...shOptions, originalText: text },
			print,
			args
		) as Doc | Promise<Doc>)) as string;

	// A `#` after an entry in a data file can belong to the entry itself
	const text =
		shCommentWrap === 'all' && !isPropertyFile(options.filepath)
			? await moveTrailingComments(printed, shOptions, reprint)
			: printed;

	return wrapComments(text, shOptions);
}

export const languages: Plugin['languages'] = pluginSh.languages;

export const options: Plugin['options'] = {
	shCommentWrap: {
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
	shTabWidth: {
		category: 'Shell',
		description: 'Number of spaces per indentation level.',
		type: 'int',
		default: 2,
	},
	shUseTabs: {
		category: 'Shell',
		description: 'Indent with tabs instead of spaces.',
		type: 'boolean',
		default: false,
	},
};

// Prettier prints with the printer of the plugin that supplies the parser
export const parsers: Plugin['parsers'] = {
	dockerfile: shParsers.dockerfile,
	sh: shParsers.sh,
};

export const printers: Plugin['printers'] = {
	dockerfile: {
		...shPrinters.dockerfile,
		print: (...[path, options, print, args]: Parameters<DockerfilePrint>) =>
			shPrinters.dockerfile.print(
				path,
				// `prettier-plugin-sh` turns this on for Dockerfiles only through the
				// default of an option this plugin doesn’t declare
				{ ...getShOptions(options, false), spaceRedirects: true },
				print,
				args
			),
	},
	sh: {
		...shPrinters.sh,
		// Prettier awaits the root print, which `prettier-plugin-sh` relies on too
		print: printWithWrappedComments as unknown as ShPrint,
	},
};

export type { PluginOptions };
