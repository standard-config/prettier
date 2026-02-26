import { getOxlintConfigs } from '@standard-config/eslint/utilities';
import { defineConfig } from '@standard-config/oxlint';

const { configBase, configConfigFiles } = getOxlintConfigs();

export default defineConfig(configBase, {
	ignorePatterns: ['fixtures/**'],
	rules: {
		'typescript/no-deprecated': 'off',
	},
	overrides: [
		{
			files: ['src/*-config/index.ts'],
			...configConfigFiles,
		},
	],
});
