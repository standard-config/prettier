import type { Plugin } from 'prettier';
import type { ParserName, PluginOptions } from './types/index.d.ts';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import * as pluginEstree from 'prettier/plugins/estree';
import { parsers as typescriptParsers } from 'prettier/plugins/typescript';
import createOxcParser from './create-oxc-parser/index.ts';
import createParser from './create-parser/index.ts';

const OXC_PARSER_NAMES: Partial<Record<string, ParserName>> = {
	JavaScript: 'oxc',
	JSX: 'oxc',
	TSX: 'oxc-ts',
	TypeScript: 'oxc-ts',
};

/**
 * Selects Oxc for Prettier’s built-in JavaScript and TypeScript languages. The
 * `estree` declarations omit the `languages` export.
 */
export const languages: Plugin['languages'] = (
	pluginEstree as Plugin
).languages!.flatMap((language) => {
	const parserName = OXC_PARSER_NAMES[language.name];

	return parserName ? [{ ...language, parsers: [parserName] }] : [];
});

export const options: Plugin['options'] = {
	tsCommentWrap: {
		category: 'JavaScript',
		description: 'Wrap comments to the preferred line length.',
		type: 'choice',
		default: 'all',
		choices: [
			{
				description:
					'Move trailing line comments onto their own lines.',
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
};

export const parsers: Plugin['parsers'] = {
	'babel': createParser('babel', babelParsers.babel),
	'oxc': createParser('oxc', createOxcParser('js')),
	'oxc-ts': createParser('oxc-ts', createOxcParser('ts')),
	'typescript': createParser('typescript', typescriptParsers.typescript),
};

export type { PluginOptions };
