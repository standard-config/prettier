import type { StandardConfig } from '../types/index.d.ts';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import mergeConfig from './index.ts';

test('returns Standard Config', () => {
	expectTypeOf(mergeConfig).returns.toEqualTypeOf<StandardConfig>();
});

test('merges two empty configs', () => {
	expect(mergeConfig({}, {})).toStrictEqual({});
});

test('merges two valid configs', () => {
	const result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
		},
		{
			printWidth: 120,
			useTabs: true,
		}
	);

	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('throws a `TypeError` when a config is missing', () => {
	/* @ts-expect-error */
	expect(() => mergeConfig()).toThrow(TypeError);

	/* @ts-expect-error */
	expect(() => mergeConfig({})).toThrow(TypeError);

	/* @ts-expect-error */
	expect(() => mergeConfig(undefined, {})).toThrow(TypeError);
});

test('removes config properties that resolve to `undefined`', () => {
	const result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
		},
		{
			printWidth: undefined,
			useTabs: true,
		}
	);

	expect(result).toStrictEqual({
		singleQuote: true,
		useTabs: true,
	});
});

test('keeps base `plugins` when the custom config omits them', () => {
	const result = mergeConfig(
		{
			plugins: ['foo'],
			printWidth: 100,
			singleQuote: true,
		},
		{
			printWidth: 120,
			useTabs: true,
		}
	);

	expect(result).toStrictEqual({
		plugins: ['foo'],
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('adds custom `plugins` when the base config omits them', () => {
	const result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
		},
		{
			plugins: ['foo'],
			printWidth: 120,
			useTabs: true,
		}
	);

	expect(result).toStrictEqual({
		plugins: ['foo'],
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('appends custom `plugins` to base `plugins`', () => {
	const result = mergeConfig(
		{
			plugins: ['foo'],
			printWidth: 100,
			singleQuote: true,
		},
		{
			plugins: ['bar', 'baz'],
			printWidth: 120,
			useTabs: true,
		}
	);

	expect(result).toStrictEqual({
		plugins: ['foo', 'bar', 'baz'],
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('removes `plugins` when the custom config sets them to `undefined`', () => {
	const result = mergeConfig(
		{
			plugins: ['foo'],
			printWidth: 100,
			singleQuote: true,
		},
		{
			plugins: undefined,
			printWidth: 120,
			useTabs: true,
		}
	);

	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('keeps base `overrides` when the custom config omits them', () => {
	const result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
			overrides: [
				{
					files: ['*.ts'],
					options: {
						singleQuote: false,
					},
				},
			],
		},
		{
			printWidth: 120,
			useTabs: true,
		}
	);

	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
		overrides: [
			{
				files: ['*.ts'],
				options: {
					singleQuote: false,
				},
			},
		],
	});
});

test('adds custom `overrides` when the base config omits them', () => {
	const result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
		},
		{
			printWidth: 120,
			useTabs: true,
			overrides: [
				{
					files: ['*.ts'],
					options: {
						singleQuote: false,
					},
				},
			],
		}
	);

	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
		overrides: [
			{
				files: ['*.ts'],
				options: {
					singleQuote: false,
				},
			},
		],
	});
});

test('appends custom `overrides` to base `overrides`', () => {
	const result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
			overrides: [
				{
					files: ['*.ts'],
					options: {
						singleQuote: false,
					},
				},
			],
		},
		{
			printWidth: 120,
			useTabs: true,
			overrides: [
				{
					files: ['*.html'],
					options: {
						printWidth: 160,
					},
				},
			],
		}
	);

	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
		overrides: [
			{
				files: ['*.ts'],
				options: {
					singleQuote: false,
				},
			},
			{
				files: ['*.html'],
				options: {
					printWidth: 160,
				},
			},
		],
	});
});

test('removes `overrides` when the custom config sets them to `undefined`', () => {
	const result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
			overrides: [
				{
					files: ['*.ts'],
					options: {
						singleQuote: false,
					},
				},
			],
		},
		{
			printWidth: 120,
			useTabs: true,
			overrides: undefined,
		}
	);

	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('doesn’t mutate any of the input configs', () => {
	const baseConfig = {
		plugins: ['foo'],
		printWidth: 100,
		singleQuote: true,
		overrides: [
			{
				files: ['*.ts'],
				options: {
					singleQuote: false,
				},
			},
		],
	} as const satisfies StandardConfig;

	const customConfig = {
		plugins: ['bar', 'baz'],
		printWidth: 120,
		singleQuote: undefined,
		useTabs: true,
		overrides: [
			{
				files: ['*.html'],
				options: {
					printWidth: 160,
				},
			},
		],
	} as const satisfies StandardConfig;

	const result = mergeConfig(baseConfig, customConfig);

	expect(result).toStrictEqual({
		plugins: ['foo', 'bar', 'baz'],
		printWidth: 120,
		useTabs: true,
		overrides: [
			{
				files: ['*.ts'],
				options: {
					singleQuote: false,
				},
			},
			{
				files: ['*.html'],
				options: {
					printWidth: 160,
				},
			},
		],
	});

	expect(result).not.toBe(baseConfig);
	expect(result).not.toBe(customConfig);

	expect(baseConfig).toHaveProperty('singleQuote', true);

	result.plugins!.push('qux');

	expect(baseConfig.plugins).toStrictEqual(['foo']);
	expect(customConfig.plugins).toStrictEqual(['bar', 'baz']);

	const baseOverride = result.overrides![0]!;

	baseOverride.files.push('*.tsx');
	baseOverride.excludeFiles = ['*.d.ts'];
	baseOverride.options.semi = false;

	expect(baseConfig.overrides[0]).toStrictEqual({
		files: ['*.ts'],
		options: {
			singleQuote: false,
		},
	});

	const customOverride = result.overrides![1]!;

	customOverride.files.push('*.svg');
	customOverride.excludeFiles = ['build/**'];
	customOverride.options.printWidth = 240;

	expect(customConfig.overrides[0]).toStrictEqual({
		files: ['*.html'],
		options: {
			printWidth: 160,
		},
	});
});
