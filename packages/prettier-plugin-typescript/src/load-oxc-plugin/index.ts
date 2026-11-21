import type { Parser, Plugin } from 'prettier';

export type OxcPlugin = Plugin & {
	parsers: Record<'oxc' | 'oxc-ts', Parser>;
};

/**
 * Loads `@prettier/plugin-oxc` when its native binding is available.
 */
export default async function loadOxcPlugin(): Promise<OxcPlugin | undefined> {
	try {
		return (await import('@prettier/plugin-oxc')) as OxcPlugin;
	} catch {
		return undefined;
	}
}
