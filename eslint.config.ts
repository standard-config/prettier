import { configConfigFiles, defineConfig } from '@standard-config/eslint';

export default defineConfig([
	{
		ignores: ['fixtures/**'],
	},
	{
		files: ['src/*-config/index.ts'],
		...configConfigFiles,
	},
]);
