export interface PluginOptions {
	/**
	 * Reflow comments that occupy their own lines. Uses the print width as a
	 * target and removes redundant `#` characters and empty comment lines.
	 * @default true
	 */
	shellWrapComments?: boolean | undefined;
}

declare module 'prettier' {
	interface Options extends PluginOptions {}
}
