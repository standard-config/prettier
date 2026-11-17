import { defineOxlintConfig } from '@standard-config/oxlint';
import { configStylisticConfigFiles } from '@standard-config/oxlint-stylistic';
import { defineConfig } from 'vite-plus';

const IGNORE_PATTERNS = [
	/* prettier-ignore */
	'packages/tests/fixtures/**',
];

export default defineConfig({
	test: {
		coverage: {
			exclude: IGNORE_PATTERNS,
		},
		projects: [
			/* prettier-ignore */
			'packages/*/vite.config.ts',
		],
	},
	lint: defineOxlintConfig({
		ignorePatterns: IGNORE_PATTERNS,
		rules: {
			'typescript/no-deprecated': 'off',
		},
		overrides: [
			{
				files: [
					/* prettier-ignore */
					'packages/*/src/*-config/index.ts',
				],
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
