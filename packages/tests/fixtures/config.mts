import type { Config } from 'prettier';
import * as pluginShell from 'prettier-plugin-shell';

export default {
	plugins: [pluginShell],
	tabWidth: 0,
	useTabs: false,
	overrides: [
		{
			files: '*.json',
			options: {
				plugins: ['prettier-plugin-sort-json'],
				parser: 'json',
				jsonRecursiveSort: true,
			},
		},
		{
			files: ['*.sh', 'fixture'],
			options: {
				shUseTabs: true,
			},
		},
	],
} as const satisfies Config;
