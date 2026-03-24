import {
	defineOxlintConfig,
	oxlintConfigConfigFiles,
} from '@standard-config/eslint/utilities';

export default defineOxlintConfig({
	ignorePatterns: ['fixtures/**'],
	rules: {
		'typescript/no-deprecated': 'off',
	},
	overrides: [
		{
			files: ['src/*-config/index.ts'],
			...oxlintConfigConfigFiles,
		},
	],
});
