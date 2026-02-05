import { defineConfig } from '@standard-config/oxlint';

export default defineConfig({
	ignorePatterns: ['fixtures/**'],
	rules: {
		'typescript/no-deprecated': 'off',
	},
});
