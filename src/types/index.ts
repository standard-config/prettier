import type {} from 'prettier';

declare module 'prettier' {
	interface Options {
		// Pending pull request:
		// https://github.com/Gudahtt/prettier-plugin-sort-json/pull/292
		jsonRecursiveSort?: boolean | undefined;
		jsonSortOrder?: string | undefined;
	}
}
