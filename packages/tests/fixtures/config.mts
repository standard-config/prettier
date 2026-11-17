import type { Config } from 'prettier';

export default {
	plugins: ['prettier-plugin-sh'],
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
	],
} as const satisfies Config;
