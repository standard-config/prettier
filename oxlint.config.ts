import { defineConfig } from '@standard-config/oxlint';

export default defineConfig({
	ignorePatterns: ['fixtures/**'],
	categories: {
		nursery: 'error',
	},
	rules: {
		'typescript/no-deprecated': 'off',
	},
});
