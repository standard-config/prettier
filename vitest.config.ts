import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: ['fixtures/**'],
		},
		typecheck: {
			enabled: true,
		},
	},
});
