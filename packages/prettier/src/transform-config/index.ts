import type {
	PrettierPlugin,
	PrettierPlugins,
} from '@standard-config/utilities/types';
import type {
	Config as PrettierConfig,
	Options as PrettierOptions,
} from 'prettier';
import type { StandardConfig, StandardOptions } from '../types/index.d.ts';
import prioritizeKeys from '@standard-config/utilities/prioritize-keys';
import { fileURLToPath } from 'node:url';
import * as pluginShell from 'prettier-plugin-shell';
import * as pluginTypeScript from 'prettier-plugin-typescript';

/**
 * Declares the shell and TypeScript plugins’ options so Prettier recognizes
 * them when an override supplies its own `plugins` list.
 */
const OPTIONS_PLUGIN: PrettierPlugin = {
	options: {
		...pluginShell.options,
		...pluginTypeScript.options,
	},
};

/**
 * Maps known plugin names to absolute paths or imported modules so Prettier can
 * load them without resolving their names from the consuming project.
 */
const PLUGINS = new Map<string, PrettierPlugin>([
	...[
		'prettier-plugin-expand-json',
		'prettier-plugin-markdown-html',
		'prettier-plugin-pkg',
		'prettier-plugin-sort-json',
		'prettier-plugin-yaml',
	].map((name) => [name, transformPlugin(name)] as const),
	// Private plugins
	['prettier-plugin-shell', pluginShell],
	['prettier-plugin-typescript', pluginTypeScript],
]);

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
						? (PLUGINS.get(plugin) ?? plugin)
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
 * Returns the path to a plugin that this package depends on.
 */
function transformPlugin(plugin: string): string {
	return fileURLToPath(import.meta.resolve(plugin));
}
