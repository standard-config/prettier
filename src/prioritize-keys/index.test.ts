import { expect, test } from 'vitest';
import prioritizeKeys from './index.ts';

const KEY_WILDCARD = {
	[/.*/ as any]: 'lexical',
};

test('returns a `jsonSortOrder` value that follows the spec', () => {
	expect(prioritizeKeys()).toBe(JSON.stringify(KEY_WILDCARD));

	expect(prioritizeKeys('')).toBe(
		JSON.stringify({
			'': null,
			...KEY_WILDCARD,
		})
	);

	expect(prioritizeKeys('foo', 'bar', 'baz')).toBe(
		JSON.stringify({
			foo: null,
			bar: null,
			baz: null,
			...KEY_WILDCARD,
		})
	);

	expect(prioritizeKeys('foo', 'foo')).toBe(
		JSON.stringify({
			foo: null,
			...KEY_WILDCARD,
		})
	);
});
