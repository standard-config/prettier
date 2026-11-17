import type { Options as PrettierOptions } from 'prettier';

export type EditorConfigProperties = Record<string, boolean | number | string>;

export type EditorConfigSection = [
	label: string,
	patterns: ReadonlyArray<string>,
	properties: EditorConfigProperties,
];

export type PrettierPlugin = NonNullable<PrettierOptions['plugins']>[number];

export type PrettierPlugins = PrettierPlugin[];
