import type { Plugin, Config as PrettierConfig } from 'prettier';
import type { StandardConfig } from '../types/index.d.ts';
import prioritizeKeys from '@standard-config/utilities/prioritize-keys';
import * as pluginShell from 'prettier-plugin-shell';
import { expect, expectTypeOf, test } from 'vite-plus/test';
import transformConfig from './index.ts';

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
					plugins: ['prettier-plugin-bar'],
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
		],
	} as const satisfies StandardConfig;

	expect(transformConfig(config)).toStrictEqual({
		plugins: [
			expect.stringContaining('node_modules'),
			'prettier-plugin-foo',
		],
		overrides: [
			{
				files: ['*.json'],
				options: {
					plugins: [
						expect.stringContaining('node_modules'),
						'prettier-plugin-bar',
					],
				},
			},
		],
	});
});

test('normalizes plugin lists', () => {
	const plugin: Plugin = {};

	expect(
		transformConfig({ plugins: [undefined, plugin] as never })
	).toStrictEqual({
		plugins: [plugin],
	});

	expect(transformConfig({ plugins: [] })).toStrictEqual({});
});

test('resolves `prettier-plugin-shell` to the bundled plugin', () => {
	expect(
		transformConfig({ plugins: ['prettier-plugin-shell'] })
	).toStrictEqual({ plugins: [pluginShell] });
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
