import type { CategorySort } from 'prettier-plugin-sort-json';

/**
 * @deprecated Use an array value for the `jsonSortOrder` property instead.
 */
export default function prioritizeKeys(...keys: ReadonlyArray<string>): string {
	const sortKeys = [...new Set(keys)];

	if (!sortKeys.includes('*')) {
		sortKeys.push('*');
	}

	/* oxlint-disable-next-line typescript/no-restricted-types */
	const order: Record<any, CategorySort | null> = {};

	for (const key of sortKeys) {
		if (key === '*') {
			/* oxlint-disable-next-line typescript/no-unsafe-member-access */
			order[createExclusionKey(sortKeys) as any] = 'lexical';
		} else {
			order[createOrderKey(key)] = null;
		}
	}

	return JSON.stringify(order);
}

/**
 * Excludes explicitly ordered keys from the wildcard’s lexical sort.
 */
function createExclusionKey(keys: ReadonlyArray<string>) {
	const escapedGroup = keys
		.filter((key) => key !== '*')
		.map((key) => key.replaceAll(/[$()*+.?[\\\]^{}|]/g, String.raw`\$&`))
		.join('|');

	return escapedGroup ? new RegExp(`^(?!(?:${escapedGroup})$).*$`) : /.*/;
}

/**
 * Uses regular expressions to preserve the order of integer-like keys and
 * prevent `__proto__` from changing the object’s prototype.
 */
function createOrderKey(key: string) {
	return key === '__proto__' || /^(?:0|[1-9]\d*)$/.test(key)
		? `/^${key}$/`
		: key;
}
