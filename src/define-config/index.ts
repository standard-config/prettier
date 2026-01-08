import type { Config } from 'prettier';
import BASE_CONFIG from '../config.ts';
import mergeConfig from '../merge-config/index.ts';

export default function defineConfig(config: Config = {}): Config {
	return mergeConfig(BASE_CONFIG, config);
}
