import type { Config, Options } from 'prettier';
import { expect, expectTypeOf, test } from 'vitest';
import mergeConfig from './index.ts';

test('merges two valid configs into one', () => {
	let result = mergeConfig({}, {});

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({});

	result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
		},
		{
			printWidth: 120,
			useTabs: true,
		}
	);

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});

	/* @ts-expect-error */
	expect(() => mergeConfig()).toThrow(TypeError);

	/* @ts-expect-error */
	expect(() => mergeConfig({})).toThrow(TypeError);

	/* @ts-expect-error */
	expect(() => mergeConfig(undefined, {})).toThrow(TypeError);
});

test('removes config options that resolve to `undefined`', () => {
	let result = mergeConfig({}, {});

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({});

	result = mergeConfig(
		{
			printWidth: 100,
			singleQuote: true,
		},
		{
			printWidth: undefined,
			useTabs: true,
		}
	);

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({
		singleQuote: true,
		useTabs: true,
	});
});

test('merges `plugins` correctly', () => {
	let result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({
		plugins: ['foo'],
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});

	result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({
		plugins: ['foo'],
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});

	result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({
		plugins: ['foo', 'bar', 'baz'],
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});

	result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('merges `overrides` correctly', () => {
	let result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
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

	result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
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

	result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
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

	result = mergeConfig(
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

	expectTypeOf(result).toEqualTypeOf<Config>();
	expect(result).toStrictEqual({
		printWidth: 120,
		singleQuote: true,
		useTabs: true,
	});
});

test('doesn’t mutate any of the input configs', () => {
	let baseConfig = {
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
	} as const satisfies Config;

	let customConfig = {
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
	} as const satisfies Config;

	let result = mergeConfig(baseConfig, customConfig);

	expectTypeOf(result).toEqualTypeOf<Config>();
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

	type ConfigOverride = {
		excludeFiles?: string[];
		files: string[];
		options: Options;
	};

	let override = result.overrides![0]! as ConfigOverride;

	override.files.push('*.tsx');
	override.excludeFiles = ['*.d.ts'];
	override.options.semi = false;

	expect(baseConfig.overrides[0]).toStrictEqual({
		files: ['*.ts'],
		options: {
			singleQuote: false,
		},
	});

	override = result.overrides![1]! as ConfigOverride;

	override.files.push('*.svg');
	override.excludeFiles = ['build/**'];
	override.options.printWidth = 240;

	expect(customConfig.overrides[0]).toStrictEqual({
		files: ['*.html'],
		options: {
			printWidth: 160,
		},
	});
});
