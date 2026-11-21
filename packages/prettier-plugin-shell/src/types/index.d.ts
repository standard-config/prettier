export interface PluginOptions {
	/**
	 * Wrap comments to the preferred line length. `full-line` skips trailing
	 * comments. `all` moves them onto their own lines before wrapping. `none`
	 * leaves comments as written.
	 *
	 * @default 'all'
	 */
	shCommentWrap?: 'all' | 'full-line' | 'none' | undefined;
	/**
	 * Specify the number of spaces per indentation level. Affects files
	 * formatted by the shell plugin.
	 *
	 * @default 2
	 */
	shTabWidth?: number | undefined;
	/**
	 * Indent lines with tabs instead of spaces. Affects files formatted by the
	 * shell plugin.
	 *
	 * @default false
	 */
	shUseTabs?: boolean | undefined;
}

declare module 'prettier' {
	interface Options extends PluginOptions {}
}
