import 'prettier';
import './vendor.d.ts';

declare module 'prettier' {
	interface Options {
		// Pending pull request:
		// https://github.com/Gudahtt/prettier-plugin-sort-json/pull/292
		jsonRecursiveSort?: boolean | undefined;
		jsonSortOrder?: string | undefined;

		// Pending pull request:
		// https://github.com/matzkoh/prettier-plugin-packagejson/pull/270
		packageSortOrder?: string[] | undefined;
	}
}
