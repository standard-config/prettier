import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import generateConfig from '../generate-config/index.ts';
import mergeConfig from '../merge-config/index.ts';

/**
 * Combine Standard Config with optional config overrides.
 */
export default function defineConfig(
	config: StandardConfig = {}
): PrettierConfig {
	const {
		shellTabWidth,
		shellUseTabs,
		tabWidth,
		useTabs,
		...extensionConfig
	} = config;

	const baseConfig = generateConfig(
		{ useTabs, tabWidth },
		{ shellUseTabs, shellTabWidth }
	);

	return mergeConfig(baseConfig, extensionConfig);
}
