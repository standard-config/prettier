import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vitest';
import prioritizeKeys from '../prioritize-keys/index.ts';
import transformConfig from './index.ts';

test('doesn’t mutate the input config', () => {
	const config = {} as const satisfies StandardConfig;
	const result = transformConfig(config);

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result).toStrictEqual({});
	expect(result).not.toBe(config);
});

test('resolves `jsonSortOrder` to a Prettier-compatible format', () => {
	const config = {
		jsonSortOrder: prioritizeKeys('$schema'),
		overrides: [
			{
				files: ['*.json'],
				options: {
					jsonSortOrder: ['dependencies', 'devDependencies'],
				},
			},
			{
				files: ['package.json'],
				options: {
					jsonSortOrder: undefined,
				},
			},
		],
	} as const satisfies StandardConfig;

	const result = transformConfig(config);

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result).toStrictEqual({
		jsonSortOrder: expect.any(String),
		overrides: [
			{
				files: ['*.json'],
				options: {
					jsonSortOrder: expect.any(String),
				},
			},
			{
				files: ['package.json'],
				options: {
					jsonSortOrder: undefined,
				},
			},
		],
	});
});

test('resolves `plugins` to a Prettier-compatible format', () => {
	const config = {
		plugins: ['prettier-plugin-sort-json', 'prettier-plugin-foo'],
		overrides: [
			{
				files: ['*.json'],
				options: {
					plugins: [
						'prettier-plugin-expand-json',
						'prettier-plugin-bar',
					],
				},
			},
			{
				files: ['package.json'],
				options: {
					plugins: ['prettier-plugin-expand-json'],
				},
			},
		],
	} as const satisfies StandardConfig;

	const result = transformConfig(config, {
		'prettier-plugin-expand-json': undefined,
	});

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result).toStrictEqual({
		plugins: [
			expect.stringContaining('node_modules'),
			'prettier-plugin-foo',
		],
		overrides: [
			{
				files: ['*.json'],
				options: {
					plugins: ['prettier-plugin-bar'],
				},
			},
			{
				files: ['package.json'],
				options: {},
			},
		],
	});
});

test('normalizes jsonSortOrder arrays on config and overrides', () => {
	const config = {
		jsonSortOrder: ['name', 'version'],
		overrides: [
			{
				files: ['*.json'],
				options: {
					jsonSortOrder: ['scripts', 'dependencies'],
				},
			},
		],
	} as const satisfies StandardConfig;

	const result = transformConfig(config);

	expect(result.jsonSortOrder).toBe(prioritizeKeys('name', 'version'));
	expect(result.overrides?.[0]?.options?.jsonSortOrder).toBe(
		prioritizeKeys('scripts', 'dependencies')
	);
});
