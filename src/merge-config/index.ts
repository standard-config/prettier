import type { StandardConfig } from '../types/index.d.ts';
import clone from '../clone/index.ts';

/**
 * Deep-merge two Standard Config objects.
 */
export default function mergeConfig(
	baseConfig: StandardConfig,
	extensionConfig: StandardConfig
): StandardConfig {
	if (!(isObject(baseConfig) && isObject(extensionConfig))) {
		throw new TypeError(
			'Standard Config error: expected config to be an object'
		);
	}

	const result = clone(baseConfig);

	for (const [key, value] of Object.entries(extensionConfig)) {
		if (value === undefined || value === null) {
			/* oxlint-disable-next-line typescript/no-dynamic-delete */
			delete result[key];
			continue;
		}

		if (isArray(value) && isArray(result[key])) {
			result[key] = [...result[key], ...clone(value)];
			continue;
		}

		result[key] = typeof value === 'object' ? clone(value) : value;
	}

	return result;
}

function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
