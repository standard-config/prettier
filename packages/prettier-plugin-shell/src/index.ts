import type { ParserOptions, Plugin } from 'prettier';
import type { PluginOptions } from './types/index.d.ts';
import separateShebang from '@standard-config/utilities/separate-shebang';
import * as pluginSh from 'prettier-plugin-sh';
import inferVariant from './infer-variant/index.ts';
import moveTrailingComments from './move-trailing-comments/index.ts';
import wrapComments from './wrap-comments/index.ts';

const { parsers: shParsers, printers: shPrinters } = pluginSh;

type ShPrint = typeof shPrinters.sh.print;

// `sh-syntax` can parse these languages. The others that `prettier-plugin-sh`
// assigns to the `sh` parser are data formats or shells with incompatible
// syntax, such as Nushell and Tcsh
const LANGUAGE_NAMES = new Set([
	'Alpine Abuild',
	'Gentoo Ebuild',
	'Gentoo Eclass',
	'husky',
	'OpenRC runscript',
	'Shell',
]);

/**
 * Returns the options for `prettier-plugin-sh`, with `shTabWidth` and
 * `shUseTabs` taking precedence over Prettier’s indentation settings.
 */
function getShOptions<T>(options: ParserOptions<T>): ParserOptions<T> {
	const { shTabWidth, shUseTabs } = options as ParserOptions<T> &
		PluginOptions;

	return {
		...options,
		simplify: true,
		tabWidth: shTabWidth!,
		useTabs: shUseTabs!,
	};
}

/**
 * Prints shell code with `prettier-plugin-sh`, separating a shebang from what
 * follows and wrapping comments as `shCommentWrap` selects.
 */
async function printShell(
	...[path, options, print, args]: Parameters<ShPrint>
): Promise<string> {
	const shOptions = {
		...getShOptions(options),
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
	// the first pass
	const separated = separateShebang(printed);
	const { shCommentWrap } = options as PluginOptions;

	if (shCommentWrap === 'none') {
		return separated;
	}

	const text =
		shCommentWrap === 'all'
			? await moveTrailingComments(separated, shOptions, printText)
			: separated;

	return wrapComments(text, shOptions);
}

export const languages: Plugin['languages'] = pluginSh.languages
	.filter(({ name }) => LANGUAGE_NAMES.has(name))
	/* oxlint-disable-next-line oxc/no-map-spread */
	.map((language) => ({
		...language,
		// `prettier-plugin-sh` classifies the dotenv file `.flaskenv` as shell
		...(language.filenames && {
			filenames: language.filenames.filter(
				(filename) => filename !== '.flaskenv'
			),
		}),
	}));

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
	sh: {
		...shPrinters.sh,
		// Prettier awaits the root print here and in `prettier-plugin-sh`
		print: printShell as unknown as ShPrint,
	},
};

export type { PluginOptions };
