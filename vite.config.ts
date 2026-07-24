import { defineOxlintConfig } from '@standard-config/oxlint';
import { configStylisticConfigFiles } from '@standard-config/oxlint-stylistic';
import { defineConfig } from 'vite-plus';

export default defineConfig({
	test: {
		coverage: {
			exclude: ['fixtures/**'],
		},
		typecheck: {
			enabled: true,
		},
	},
	lint: defineOxlintConfig({
		ignorePatterns: ['fixtures/**'],
		rules: {
			'typescript/no-deprecated': 'off',
		},
		overrides: [
			{
				files: ['src/*-config/index.ts'],
				...configStylisticConfigFiles,
			},
		],
	}),
	pack: {
		deps: {
			neverBundle: true,
		},
		dts: {
			sourcemap: true,
		},
		entry: 'src/index.ts',
		failOnWarn: true,
		publint: true,
		sourcemap: true,
	},
	staged: {
		'*': [
			() => 'pnpm install --ignore-scripts',
			'prettier --ignore-unknown --write',
			() => 'pnpm prepack',
		],
	},
});
