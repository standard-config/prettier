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
			exclude: [
				/* prettier-ignore */
				...IGNORE_PATTERNS,
				'**/coverage/**',
				'**/dist/**',
			],
			enabled: true,
			reporter: [
				/* prettier-ignore */
				'json',
				['text', { skipFull: true }],
			],
			thresholds: {
				100: true,
			},
		},
		projects: [
			/* prettier-ignore */
			'packages/*/vite.config.ts',
		],
	},
	lint: defineOxlintConfig({
		ignorePatterns: IGNORE_PATTERNS,
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
