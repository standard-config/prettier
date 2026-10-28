import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, onTestFinished, test, vi } from 'vite-plus/test';
import prioritizeKeys from '../prioritize-keys/index.ts';
import transformConfig from './index.ts';

const CONFIG = {
	overrides: [
		{
			files: ['*.json'],
			options: {
				plugins: ['prettier-plugin-foo'],
			},
		},
		{
			files: ['*.sh'],
			options: {
				plugins: ['prettier-plugin-sh'],
			},
		},
		{
			files: ['*.md'],
			options: {
				proseWrap: 'never',
			},
		},
	],
} as const satisfies StandardConfig;

test('returns a Prettier config', () => {
	expectTypeOf(transformConfig).returns.toEqualTypeOf<PrettierConfig>();
});

test('returns an empty config for an empty input', () => {
	expect(transformConfig({})).toStrictEqual({});
});

test('doesn’t mutate the input config', () => {
	const config = {
		jsonSortOrder: ['name', 'version'],
		plugins: [
			/* prettier-ignore */
			'prettier-plugin-sort-json',
			'prettier-plugin-foo',
		],
		overrides: [
			{
				files: ['*.json'],
				options: {
					jsonSortOrder: ['dependencies', 'devDependencies'],
					plugins: ['prettier-plugin-bar'],
				},
			},
		],
	} as const satisfies StandardConfig;

	const input = structuredClone(config);
	const result = transformConfig(config);

	expect(result).toStrictEqual({
		jsonSortOrder: prioritizeKeys('name', 'version'),
		plugins: [
			expect.stringContaining('node_modules'),
			'prettier-plugin-foo',
		],
		overrides: [
			{
				files: ['*.json'],
				options: {
					jsonSortOrder: prioritizeKeys(
						'dependencies',
						'devDependencies'
					),
					plugins: [
						expect.stringContaining('prettier-plugin-sh'),
						'prettier-plugin-bar',
					],
				},
			},
		],
	});

	expect(result).not.toBe(config);
	expect(config).toStrictEqual(input);
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

	expect(result).toStrictEqual({
		jsonSortOrder: prioritizeKeys('$schema'),
		overrides: [
			{
				files: ['*.json'],
				options: {
					jsonSortOrder: prioritizeKeys(
						'dependencies',
						'devDependencies'
					),
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

	expect(result).toStrictEqual({
		plugins: [
			expect.stringContaining('node_modules'),
			'prettier-plugin-foo',
		],
		overrides: [
			{
				files: ['*.json'],
				options: {
					plugins: [
						expect.stringContaining('prettier-plugin-sh'),
						'prettier-plugin-bar',
					],
				},
			},
			{
				files: ['package.json'],
				options: {},
			},
		],
	});
});

test('keeps `prettier-plugin-sh` in override `plugins`', () => {
	expect(transformConfig(CONFIG)).toStrictEqual({
		overrides: [
			{
				files: ['*.json'],
				options: {
					plugins: [
						expect.stringContaining('prettier-plugin-sh'),
						'prettier-plugin-foo',
					],
				},
			},
			{
				files: ['*.sh'],
				options: {
					plugins: [expect.stringContaining('prettier-plugin-sh')],
				},
			},
			{
				files: ['*.md'],
				options: {
					proseWrap: 'never',
				},
			},
		],
	});
});

test('omits `prettier-plugin-sh` from override `plugins` when `pluginOverrides` sets it to `undefined`', () => {
	expect(
		transformConfig(CONFIG, {
			'prettier-plugin-sh': undefined,
		})
	).toStrictEqual({
		overrides: [
			{
				files: ['*.json'],
				options: {
					plugins: ['prettier-plugin-foo'],
				},
			},
			{
				files: ['*.sh'],
				options: {},
			},
			{
				files: ['*.md'],
				options: {
					proseWrap: 'never',
				},
			},
		],
	});
});

test('omits `@prettier/plugin-oxc` config when it’s unavailable', async () => {
	vi.resetModules();
	vi.doMock('@prettier/plugin-oxc', () => {
		throw new Error();
	});

	onTestFinished(() => {
		vi.doUnmock('@prettier/plugin-oxc');
		vi.resetModules();
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

test('normalizes `jsonSortOrder` arrays on config and overrides', () => {
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

	expect(transformConfig(config)).toStrictEqual({
		jsonSortOrder: prioritizeKeys('name', 'version'),
		overrides: [
			{
				files: ['*.json'],
				options: {
					jsonSortOrder: prioritizeKeys('scripts', 'dependencies'),
				},
			},
		],
	});
});
