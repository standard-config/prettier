import type { PrettierPlugins } from '@standard-config/utilities/types';
import type {
	Plugin,
	Config as PrettierConfig,
	Options as PrettierOptions,
} from 'prettier';
import type { StandardConfig, StandardOptions } from '../types/index.d.ts';
import prioritizeKeys from '@standard-config/utilities/prioritize-keys';
import { fileURLToPath } from 'node:url';
import * as pluginExpandJSON from 'prettier-plugin-expand-json';
import * as pluginMarkdownHTML from 'prettier-plugin-markdown-html';
import * as pluginPkg from 'prettier-plugin-pkg';
import * as pluginShell from 'prettier-plugin-shell';
import * as pluginSortJSON from 'prettier-plugin-sort-json';
import * as pluginTypeScript from 'prettier-plugin-typescript';
import * as pluginYAML from 'prettier-plugin-yaml';

/**
 * Maps shipped plugin names to their options and modules or absolute paths.
 */
const PLUGINS = new Map([
	registerPlugin('prettier-plugin-expand-json', pluginExpandJSON),
	registerPlugin('prettier-plugin-markdown-html', pluginMarkdownHTML),
	registerPlugin('prettier-plugin-pkg', pluginPkg),
	registerPlugin('prettier-plugin-shell', pluginShell, true),
	registerPlugin('prettier-plugin-sort-json', pluginSortJSON),
	registerPlugin('prettier-plugin-typescript', pluginTypeScript, true),
	registerPlugin('prettier-plugin-yaml', pluginYAML),
]);

/**
 * Declares the shipped plugins’ options so an override can replace the plugin
 * list without losing option definitions or inheriting parsers and printers.
 */
const OPTIONS_PLUGIN = { options: {} } satisfies Plugin;

for (const { options } of PLUGINS.values()) {
	Object.assign(OPTIONS_PLUGIN.options, options);
}

/**
 * Converts Standard Config to an exportable, Prettier-compatible format.
 */
export default function transformConfig(
	config: StandardConfig
): PrettierConfig {
	const { overrides } = config;

	return {
		...transformOptions(config),
		...(overrides && {
			/* oxlint-disable-next-line oxc/no-map-spread */
			overrides: overrides.map((override) => ({
				...override,
				options: transformOptions(override.options, [OPTIONS_PLUGIN]),
			})),
		}),
	};
}

/**
 * Converts options to a Prettier-compatible format. Prepends `fallbackPlugins`
 * to any `plugins` list so its plugins can override the fallback declarations.
 */
function transformOptions(
	options: StandardOptions,
	fallbackPlugins: PrettierPlugins = []
): PrettierOptions {
	const { plugins, jsonSortOrder } = options;

	return {
		...options,
		...(jsonSortOrder !== undefined && {
			jsonSortOrder: transformJSONSortOrder(jsonSortOrder),
		}),
		...(plugins && {
			plugins: [
				...fallbackPlugins,
				...plugins.map((plugin) =>
					typeof plugin === 'string'
						? (PLUGINS.get(plugin)?.plugin ?? plugin)
						: plugin
				),
			],
		}),
	} as PrettierOptions;
}

/**
 * Converts a key list to a `jsonSortOrder` string and passes strings through.
 */
function transformJSONSortOrder(jsonSortOrder: string | string[]): string {
	if (Array.isArray(jsonSortOrder)) {
		return prioritizeKeys(...jsonSortOrder);
	}

	return jsonSortOrder;
}

/**
 * Reads options from the same export Prettier would load. An absolute path lets
 * Prettier load an external plugin from Standard Config’s dependencies.
 */
function registerPlugin(
	name: string,
	module: Plugin & { default?: Plugin },
	bundled = false
) {
	const plugin = module.default ?? module;

	return [
		name,
		{
			options: plugin.options,
			plugin: bundled ? plugin : fileURLToPath(import.meta.resolve(name)),
		},
	] as const;
}
