// Pending pull request:
// https://github.com/matzkoh/prettier-plugin-packagejson/pull/270
declare module 'prettier-plugin-packagejson' {
	import type { Plugin } from 'prettier';

	export const testPath: (path: string) => boolean;

	export const options: NonNullable<Plugin['options']>;
	export const parsers: NonNullable<Plugin['parsers']>;
}
