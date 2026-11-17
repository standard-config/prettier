import type { StandardConfig } from '@standard-config/utilities/types';
import type { Config as PrettierConfig } from 'prettier';
import mergeConfig from '@standard-config/utilities/merge-config';
import generateConfig from '../generate-config/index.ts';
import transformConfig from '../transform-config/index.ts';

/**
 * Combines Standard Config with optional config overrides.
 */
export default function defineConfig(
	config: StandardConfig = {}
): PrettierConfig {
	const {
		pluginOverrides,
		shellTabWidth,
		shellUseTabs,
		tabWidth,
		useTabs,
		...extensionConfig
	} = config;

	const baseConfig = generateConfig(
		{ tabWidth, useTabs },
		{ shellTabWidth, shellUseTabs }
	);

	const extendedConfig = mergeConfig(baseConfig, extensionConfig);
	return transformConfig(extendedConfig, pluginOverrides);
}
