import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import BASE_CONFIG from '../base-config/index.ts';
import mergeConfig from '../merge-config/index.ts';
import transformConfig from '../transform-config/index.ts';

/**
 * Combines Standard Config with optional config overrides.
 */
export default function defineConfig(
	config: StandardConfig = {}
): PrettierConfig {
	const { pluginOverrides, ...extensionConfig } = config;

	return transformConfig(
		mergeConfig(BASE_CONFIG, extensionConfig),
		pluginOverrides
	);
}
