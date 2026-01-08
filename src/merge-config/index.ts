import type { Config } from 'prettier';
import { klona as clone } from 'klona/lite';

export default function mergeConfig(
	baseConfig: Config,
	extensionConfig: Config
): Config {
	if (
		!(typeof baseConfig === 'object' && typeof extensionConfig === 'object')
	) {
		throw new TypeError(
			'Prettier config error: expected config to be an object'
		);
	}

	const result = clone(baseConfig);

	for (const [key, value] of Object.entries(clone(extensionConfig))) {
		if (value === undefined) {
			/* oxlint-disable-next-line typescript/no-dynamic-delete */
			delete result[key];
			continue;
		}

		if (isArray(value) && isArray(result[key])) {
			result[key] = [...result[key], ...value];
			continue;
		}

		result[key] = value;
	}

	return result;
}

function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}
