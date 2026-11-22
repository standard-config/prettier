import type {
	PrettierPlugin,
	PrettierPlugins,
} from '@standard-config/utilities/types';
import type { Config as PrettierConfig } from 'prettier';
import type { StandardConfig, StandardOptions } from '../types/index.d.ts';
import clone from '@standard-config/utilities/clone';
import prioritizeKeys from '@standard-config/utilities/prioritize-keys';
import { fileURLToPath } from 'node:url';
import * as pluginShell from 'prettier-plugin-shell';
import * as pluginTypeScript from 'prettier-plugin-typescript';

/**
 * Converts Standard Config to an exportable, Prettier-compatible format.
 */
export default function transformConfig(
	config: StandardConfig
): PrettierConfig {
	/* oxlint-disable-next-line eslint/no-param-reassign */
	config = clone(config);

	/* oxlint-disable-next-line unicorn/consistent-function-scoping */
	const transform = (options: StandardOptions) => {
		if (options.jsonSortOrder) {
			options.jsonSortOrder = transformJSONSortOrder(
				options.jsonSortOrder
			);
		}

		if (options.plugins) {
			const plugins = transformPlugins(options.plugins);

			if (plugins.length > 0) {
				options.plugins = plugins;
			} else {
				delete options.plugins;
			}
		}
	};

	transform(config);

	for (const override of config.overrides ?? []) {
		transform(override.options);
	}

	return config as PrettierConfig;
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
 * Resolves known plugin paths.
 */
function transformPlugins(plugins: PrettierPlugins): PrettierPlugins {
	const pluginMap: Record<string, PrettierPlugin> = {
		...Object.fromEntries(
			[
				'@prettier/plugin-oxc',
				'prettier-plugin-expand-json',
				'prettier-plugin-markdown-html',
				'prettier-plugin-pkg',
				'prettier-plugin-sort-json',
				'prettier-plugin-yaml',
			].map((name) => [name, transformPlugin(name)])
		),
		// Private plugins
		'prettier-plugin-shell': pluginShell,
		'prettier-plugin-typescript': pluginTypeScript,
	};

	const resolved: PrettierPlugins = [];

	for (const plugin of plugins) {
		const resolvedPlugin =
			typeof plugin === 'string' && Object.hasOwn(pluginMap, plugin)
				? pluginMap[plugin]
				: plugin;

		if (resolvedPlugin) {
			resolved.push(resolvedPlugin);
		}
	}

	return resolved;
}

/**
 * Returns a plugin path or its unresolved name.
 */
function transformPlugin(plugin: string): string {
	try {
		return fileURLToPath(import.meta.resolve(plugin));
	} catch {
		/* v8 ignore next -- @preserve */
		return plugin;
	}
}
