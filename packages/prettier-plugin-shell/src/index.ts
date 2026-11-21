import type { ParserOptions, Plugin } from 'prettier';
import type { PluginOptions } from './types/index.d.ts';
import separateShebang from '@standard-config/utilities/separate-shebang';
import * as pluginSh from 'prettier-plugin-sh';
import inferVariant from './infer-variant/index.ts';
import isPropertyFile from './is-property-file/index.ts';
import moveTrailingComments from './move-trailing-comments/index.ts';
import wrapComments from './wrap-comments/index.ts';

const { parsers: shParsers, printers: shPrinters } = pluginSh;

type DockerfilePrint = typeof shPrinters.dockerfile.print;
type ShPrint = typeof shPrinters.sh.print;

/**
 * Returns the options for `prettier-plugin-sh`, with `shTabWidth` and
 * `shUseTabs` taking precedence over Prettier’s indentation settings.
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
 * Prints shell code with `prettier-plugin-sh`, separating a shebang from what
 * follows and wrapping comments as `shCommentWrap` selects.
 */
async function printShell(
	...[path, options, print, args]: Parameters<ShPrint>
): Promise<string> {
	const isDataFile = isPropertyFile(options.filepath);

	// Simplifying data files could change the values they hold
	const shOptions = {
		...getShOptions(options, !isDataFile),
		variant: inferVariant(options.originalText, options.filepath),
	};

	// `prettier-plugin-sh` prints a string asynchronously despite its `Doc`
	// return type
	const printText = async (text: string) =>
		shPrinters.sh.print(
			path,
			{ ...shOptions, originalText: text },
			print,
			args
		) as unknown as Promise<string>;

	const printed = await printText(options.originalText);

	// Separate the shebang so a comment directly below the `#!` lines wraps on
	// the first pass. In data files, `#!` starts an ordinary comment
	const separated = isDataFile ? printed : separateShebang(printed);
	const { shCommentWrap } = options as PluginOptions;

	if (shCommentWrap === 'none') {
		return separated;
	}

	// A `#` after an entry in a data file can belong to the entry itself
	const text =
		shCommentWrap === 'all' && !isDataFile
			? await moveTrailingComments(separated, shOptions, printText)
			: separated;

	return wrapComments(text, shOptions);
}

export const languages: Plugin['languages'] = pluginSh.languages;

export const options: Plugin['options'] = {
	shCommentWrap: {
		category: 'Shell',
		description: 'Wrap comments to the preferred line length.',
		type: 'choice',
		default: 'all',
		choices: [
			{
				description: 'Move trailing comments onto their own lines.',
				value: 'all',
			},
			{
				description: 'Wrap comments already on their own lines.',
				value: 'full-line',
			},
			{
				description: 'Leave comments as written.',
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
	sh: {
		...shParsers.sh,
		parse: async (text, options) =>
			shParsers.sh.parse(text, {
				...options,
				variant: inferVariant(text, options.filepath),
			}),
	},
};

export const printers: Plugin['printers'] = {
	dockerfile: {
		...shPrinters.dockerfile,
		print: (...[path, options, print, args]: Parameters<DockerfilePrint>) =>
			shPrinters.dockerfile.print(
				path,
				// `prettier-plugin-sh` turns this on for Dockerfiles only
				// through the default of an option this plugin doesn’t declare
				{ ...getShOptions(options, false), spaceRedirects: true },
				print,
				args
			),
	},
	sh: {
		...shPrinters.sh,
		// Prettier awaits the root print here and in `prettier-plugin-sh`
		print: printShell as unknown as ShPrint,
	},
};

export type { PluginOptions };
