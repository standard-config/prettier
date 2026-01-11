import type { Config } from 'prettier';
import { DEFAULT_CONFIG } from '../config.ts';
import mergeConfig from '../merge-config/index.ts';

export default function defineConfig(config: Config = {}): Config {
	return mergeConfig(DEFAULT_CONFIG, config);
}
