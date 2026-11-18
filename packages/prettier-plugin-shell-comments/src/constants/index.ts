export const DIRECTIVE_PATTERN =
	/^(?:-\*-|bats$|bats[ \t]+file_tags=|bats[ \t]+test_tags=|dotenv-linter:|endregion(?:[ \t]|$)|region(?:[ \t]|$)|shellcheck(?:[ \t]|$)|SPDX-[A-Za-z-]+:|vi:|vim:)/;

export const IGNORE_MARKER_PATTERN = /^#+[ \t]*prettier-ignore$/;

export const MARK_PREFIX = 'prettier_plugin_shell_comments_mark_';

export const PRAGMA_PATTERN = /^@(?:format|prettier)/;
