import { format } from 'prettier';
import { expect, test } from 'vite-plus/test';
import prioritizeKeys from './index.ts';

const TEST_JSON = `{
	"foo": "bar",
	"__proto__": "baz",
	"0": "qux",
	"1": "quux",
	"2": "corge"
}
`;

async function sortJSON(jsonSortOrder: string) {
	return format(TEST_JSON, {
		parser: 'json',
		plugins: ['prettier-plugin-sort-json'],
		jsonSortOrder,
	});
}

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

test('keeps the requested order for `__proto__`', async () => {
	const output = await sortJSON(prioritizeKeys('__proto__', 'foo'));

	expect(output).toMatchInlineSnapshot(`
		"{
		  "__proto__": "baz",
		  "foo": "bar",
		  "0": "qux",
		  "1": "quux",
		  "2": "corge"
		}
		"
	`);
});

test('keeps the requested order for integer-like keys', async () => {
	const output = await sortJSON(prioritizeKeys('2', '0', '*', '1'));

	expect(output).toMatchInlineSnapshot(`
		"{
		  "2": "corge",
		  "0": "qux",
		  "__proto__": "baz",
		  "foo": "bar",
		  "1": "quux"
		}
		"
	`);
});
