import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import { beforeEach, expect, expectTypeOf, test, vi } from 'vite-plus/test';
import prioritizeKeys from '../prioritize-keys/index.ts';

beforeEach(() => {
	vi.resetModules();
});

test('doesn’t mutate the input config', async () => {
	const { default: transformConfig } = await import('./index.ts');

	const config = {} as const satisfies StandardConfig;
	const result = transformConfig(config);

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result).toStrictEqual({});
	expect(result).not.toBe(config);
});

test('resolves `jsonSortOrder` to a Prettier-compatible format', async () => {
	const { default: transformConfig } = await import('./index.ts');

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

test('resolves `plugins` to a Prettier-compatible format', async () => {
	const { default: transformConfig } = await import('./index.ts');

	const config = {
		plugins: [
			/* prettier-ignore */
			'prettier-plugin-sort-json',
			'prettier-plugin-foo',
		],
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

test('omits `@prettier/plugin-oxc` config when it’s unavailable', async () => {
	vi.doMock('@prettier/plugin-oxc', () => {
		throw new Error();
	});

	const { default: transformConfig } = await import('./index.ts');

	const config = {
		plugins: [
			/* prettier-ignore */
			'@prettier/plugin-oxc',
			'prettier-plugin-foo',
		],
		overrides: [
			{
				files: ['*.js'],
				options: {
					parser: 'oxc',
				},
			},
			{
				files: ['*.ts'],
				options: {
					parser: 'oxc-ts',
				},
			},
		],
	} as const satisfies StandardConfig;

	const result = transformConfig(config);

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result).toStrictEqual({
		plugins: ['prettier-plugin-foo'],
		overrides: [
			{
				files: ['*.js'],
				options: {},
			},
			{
				files: ['*.ts'],
				options: {},
			},
		],
	});
});

test('normalizes `jsonSortOrder` arrays on config and overrides', async () => {
	const { default: transformConfig } = await import('./index.ts');

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

	expectTypeOf(result).toEqualTypeOf<PrettierConfig>();
	expect(result.jsonSortOrder).toBe(prioritizeKeys('name', 'version'));
	expect(result.overrides?.[0]?.options?.jsonSortOrder).toBe(
		prioritizeKeys('scripts', 'dependencies')
	);
});
