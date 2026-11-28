import type { Parser, ParserOptions, Plugin, Printer } from 'prettier';
import type { File } from 'sh-syntax';
import type { PluginOptions } from './types/index.d.ts';
import separateShebang from '@standard-config/utilities/separate-shebang';
import { basename, dirname } from 'node:path';
import { createSourceIndex, ParseError, processor } from 'sh-syntax';
import {
	LEADING_TRIVIA_LINE_PATTERN,
	PRAGMA_PATTERN,
} from './constants/index.ts';
import inferVariant from './infer-variant/index.ts';
import moveTrailingComments from './move-trailing-comments/index.ts';
import wrapComments from './wrap-comments/index.ts';

type ShellOptions = ParserOptions & { variant: number };

/**
 * Checks for a standalone `@format` or `@prettier` pragma in leading comments.
 */
function hasPragma(text: string): boolean {
	for (const line of text.split('\n')) {
		const match = LEADING_TRIVIA_LINE_PATTERN.exec(line);

		if (!match) {
			return false;
		}

		if (PRAGMA_PATTERN.test(match.groups?.comment?.trim() ?? '')) {
			return true;
		}
	}

	return false;
}

/**
 * Returns the options with `shTabWidth` and `shUseTabs` taking precedence over
 * Prettier’s indentation settings.
 */
function getShOptions<T>(options: ParserOptions<T>): ParserOptions<T> {
	const { shTabWidth, shUseTabs } = options as ParserOptions<T> &
		PluginOptions;

	return { ...options, tabWidth: shTabWidth!, useTabs: shUseTabs! };
}

/**
 * Prints shell code with `sh-syntax`, separating a shebang from what follows
 * and wrapping comments as `shCommentWrap` selects.
 */
async function printShell(
	...[, options]: Parameters<Printer<File>['print']>
): Promise<string> {
	const shOptions: ShellOptions = {
		...getShOptions(options),
		variant: inferVariant(options.originalText, options.filepath),
	};

	const printText = async (text: string) =>
		processor(text, {
			filepath: shOptions.filepath,
			print: true,
			simplify: true,
			tabWidth: shOptions.tabWidth,
			useTabs: shOptions.useTabs,
			variant: shOptions.variant,
		});

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

// One language holds the curated file names, extensions, and interpreters of
// scripts that `sh-syntax` can format, with aliases for code blocks that name a
// tool, such as `abuild` or `husky`
export const languages: Plugin['languages'] = [
	{
		name: 'Shell',
		aliases: [
			'abuild',
			'apkbuild',
			'bash',
			'envrc',
			'husky',
			'openrc',
			'sh',
			'shell-script',
			'zsh',
		],
		extensions: [
			'.bash',
			'.bats',
			'.command',
			'.ebuild',
			'.eclass',
			'.ksh',
			'.mksh',
			'.sbatch',
			'.sh',
			'.sh.in',
			'.slurm',
			'.tmux',
			'.tool',
			'.zsh',
			'.zsh-theme',
		],
		filenames: [
			'.bash_aliases',
			'.bash_functions',
			'.bash_logout',
			'.bash_profile',
			'.bashrc',
			'.envrc',
			'.kshrc',
			'.profile',
			'.xinitrc',
			'.xsession',
			'.zlogin',
			'.zlogout',
			'.zprofile',
			'.zshenv',
			'.zshrc',
			'APKBUILD',
			'bash_aliases',
			'bash_logout',
			'bash_profile',
			'bashrc',
			'kshrc',
			'PKGBUILD',
			'xinitrc',
			'xsession',
			'zlogin',
			'zlogout',
			'zprofile',
			'zshenv',
			'zshrc',
		],
		interpreters: [
			'ash',
			'bash',
			'bats',
			'dash',
			'ksh',
			'mksh',
			'openrc-run',
			'pdksh',
			'sh',
			'zsh',
		],
		// Hooks are files without an extension directly inside `.husky`, which
		// can also hold files such as `.gitignore`
		isSupported: ({ filepath }) =>
			basename(dirname(filepath)) === '.husky' &&
			!basename(filepath).includes('.'),
		parsers: ['sh'],
		vscodeLanguageIds: ['shellscript'],
	},
];

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
		astFormat: 'sh',
		hasPragma,
		locEnd: (node) => node.end,
		locStart: (node) => node.start,
		// The printer uses the original text, so report syntax errors here
		parse: async (text, options) => {
			try {
				return await processor(text, {
					filepath: options.filepath,
					variant: inferVariant(text, options.filepath),
				});
			} catch (error) {
				if (error instanceof ParseError && error.pos) {
					const { column, line, offset } = error.pos;
					const sourceIndex = createSourceIndex(text);

					// Convert the byte offsets to UTF-16 before measuring
					// Prettier’s one-based column
					const lineStart = sourceIndex(offset - column);
					const start = {
						column: sourceIndex(offset) - lineStart + 1,
						line,
					};

					Object.assign(error, { loc: { start } });
				}

				throw error;
			}
		},
	} satisfies Parser<File>,
};

export const printers: Plugin['printers'] = {
	sh: {
		// Prettier awaits the root print
		print: printShell as unknown as Printer<File>['print'],
	},
};

export type { PluginOptions };
