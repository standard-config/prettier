export interface PluginOptions {
	/**
	 * Control wrapping for comments. `all` moves trailing comments onto
	 * their own lines, then reflows every comment. `full-line` reflows only
	 * the comments that occupy their own lines. `none` leaves all comments as
	 * written. Reflowing uses the print width as a target and removes redundant
	 * `#` characters and empty comment lines.
	 * @default 'all'
	 */
	shCommentWrap?: 'all' | 'full-line' | 'none' | undefined;
	/**
	 * Specify the number of spaces per indentation level. Affects files
	 * formatted by the shell plugin.
	 * @default 2
	 */
	shTabWidth?: number | undefined;
	/**
	 * Indent lines with tabs instead of spaces. Affects files formatted by the
	 * shell plugin.
	 * @default false
	 */
	shUseTabs?: boolean | undefined;
}

declare module 'prettier' {
	interface Options extends PluginOptions {}
}
