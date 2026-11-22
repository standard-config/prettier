import type { PrettierPlugins } from '@standard-config/utilities/types';
import type { Config as PrettierConfig } from 'prettier';
import type {
	StandardConfig,
	StandardConfigPluginOverrides,
	StandardOptions,
} from '../types/index.d.ts';
import clone from '@standard-config/utilities/clone';
import prioritizeKeys from '@standard-config/utilities/prioritize-keys';
import { fileURLToPath } from 'node:url';
import * as pluginShell from 'prettier-plugin-shell';
import * as pluginTypeScript from 'prettier-plugin-typescript';

let disableOxcParser = false;

try {
	await import('@prettier/plugin-oxc');
} catch {
	disableOxcParser = true;
}

/**
 * Converts Standard Config to an exportable, Prettier-compatible format.
 */
export default function transformConfig(
	config: StandardConfig,
	pluginOverrides: StandardConfigPluginOverrides = {}
): PrettierConfig {
	/* oxlint-disable-next-line eslint/no-param-reassign */
	config = clone(config);

	const transform = (options: StandardOptions) => {
		if (options.jsonSortOrder) {
			options.jsonSortOrder = transformJSONSortOrder(
				options.jsonSortOrder
			);
		}

		if (options.plugins) {
			const plugins = transformPlugins(options.plugins, pluginOverrides);

			if (plugins.length > 0) {
				options.plugins = plugins;
			} else {
				delete options.plugins;
			}
		}

		if (disableOxcParser) {
			const { parser } = options;

			if (typeof parser === 'string' && parser.startsWith('oxc')) {
				delete options.parser;
			}
		}
	};

	transform(config);

	for (const override of config.overrides ?? []) {
		transform(override.options);
	}

	return config as PrettierConfig;
}

function transformJSONSortOrder(jsonSortOrder: string | string[]): string {
	if (Array.isArray(jsonSortOrder)) {
		return prioritizeKeys(...jsonSortOrder);
	}

	return jsonSortOrder;
}

function transformPlugins(
	plugins: PrettierPlugins,
	pluginOverrides: StandardConfigPluginOverrides
): PrettierPlugins {
	const pluginMap: StandardConfigPluginOverrides = {
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
		...pluginOverrides,
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

function transformPlugin(plugin: string): string | undefined {
	if (disableOxcParser && plugin === '@prettier/plugin-oxc') {
		return undefined;
	}

	try {
		return fileURLToPath(import.meta.resolve(plugin));
	} catch {
		/* v8 ignore next -- @preserve */
		return plugin;
	}
}
