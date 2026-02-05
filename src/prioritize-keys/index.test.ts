import { expect, test } from 'vitest';
import prioritizeKeys from './index.ts';

test('returns a `jsonSortOrder` value that follows the spec', () => {
	expect(prioritizeKeys()).toBe(
		JSON.stringify({
			[/.*/ as any]: 'lexical',
		})
	);

	expect(prioritizeKeys('*')).toBe(prioritizeKeys());

	expect(prioritizeKeys('*', '*')).toBe(prioritizeKeys());

	expect(prioritizeKeys('foo')).toBe(
		JSON.stringify({
			foo: null,
			[/^(?!(?:foo)$).*$/ as any]: 'lexical',
		})
	);

	expect(prioritizeKeys('foo', 'foo')).toBe(prioritizeKeys('foo'));

	expect(prioritizeKeys('foo.bar')).toBe(
		JSON.stringify({
			'foo.bar': null,
			[/^(?!(?:foo\.bar)$).*$/ as any]: 'lexical',
		})
	);

	expect(prioritizeKeys('foo', 'bar', 'baz')).toBe(
		JSON.stringify({
			foo: null,
			bar: null,
			baz: null,
			[/^(?!(?:foo|bar|baz)$).*$/ as any]: 'lexical',
		})
	);

	expect(prioritizeKeys('foo', 'bar', 'baz', '*')).toBe(
		prioritizeKeys('foo', 'bar', 'baz')
	);

	expect(prioritizeKeys('foo', '*', 'bar', 'baz')).toBe(
		JSON.stringify({
			foo: null,
			[/^(?!(?:foo|bar|baz)$).*$/ as any]: 'lexical',
			bar: null,
			baz: null,
		})
	);

	expect(prioritizeKeys('foo', 'bar', '*', 'baz')).toBe(
		JSON.stringify({
			foo: null,
			bar: null,
			[/^(?!(?:foo|bar|baz)$).*$/ as any]: 'lexical',
			baz: null,
		})
	);
});
