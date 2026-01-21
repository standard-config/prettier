import type { Config } from 'prettier';

export default {
	plugins: ['prettier-plugin-sh'],
	tabWidth: 0,
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
			files: '*.md',
			options: {
				useTabs: true,
			},
		},
		{
			files: '*.svg',
			options: {
				parser: 'html',
			},
		},
	],
} as const satisfies Config;
