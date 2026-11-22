import type { Plugin } from 'prettier';
import type { PluginOptions } from './types/index.d.ts';
import { parsers as oxcParsers } from '@prettier/plugin-oxc';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { parsers as typescriptParsers } from 'prettier/plugins/typescript';
import createParser from './create-parser/index.ts';

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

// Prettier uses the parser from the last plugin that defines it, so this plugin
// has to come after `@prettier/plugin-oxc` in the plugin list
export const parsers: Plugin['parsers'] = {
	'babel': createParser('babel', babelParsers.babel),
	'oxc': createParser('oxc', oxcParsers.oxc),
	'oxc-ts': createParser('oxc-ts', oxcParsers['oxc-ts']),
	'typescript': createParser('typescript', typescriptParsers.typescript),
};

export type { PluginOptions };
