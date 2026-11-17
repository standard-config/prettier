import { defineOxlintConfig } from '@standard-config/oxlint';
import { configStylisticConfigFiles } from '@standard-config/oxlint-stylistic';
import { defineConfig } from 'vite-plus';

export default defineConfig({
	test: {
		coverage: {
			exclude: ['packages/tests/fixtures/**'],
		},
		projects: ['packages/*/vite.config.ts'],
	},
	lint: defineOxlintConfig({
		ignorePatterns: ['packages/tests/fixtures/**'],
		rules: {
			'typescript/no-deprecated': 'off',
		},
		overrides: [
			{
				files: ['packages/*/src/*-config/index.ts'],
				...configStylisticConfigFiles,
			},
		],
	}),
	staged: {
		'*': [
			() => 'pnpm install --frozen-lockfile --ignore-scripts',
			() => 'pnpm build',
			'prettier --ignore-unknown --write',
			() => 'pnpm prepack',
		],
	},
});
