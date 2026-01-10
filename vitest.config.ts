import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			thresholds: {
				branches: 100,
				functions: 100,
				statements: 100,
			},
		},
		typecheck: {
			enabled: true,
		},
	},
});
