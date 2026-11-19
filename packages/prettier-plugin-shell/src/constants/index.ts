// `LangVariant.LangBash` in `sh-syntax`
export const BASH_VARIANT = 1;

// `LangVariant.LangBats` in `sh-syntax`
export const BATS_VARIANT = 8;

export const DIRECTIVE_PATTERN =
	/^(?:-\*-|bats$|bats[ \t]+file_tags=|bats[ \t]+test_tags=|dotenv-linter:|endregion(?:[ \t]|$)|region(?:[ \t]|$)|shellcheck(?:[ \t]|$)|SPDX-[A-Za-z-]+:|vi:|vim:)/;

export const IGNORE_MARKER_PATTERN = /^#+[ \t]*prettier-ignore$/;

export const MARK_PREFIX = 'prettier_plugin_shell_mark_';

// `LangVariant.LangMirBSDKorn` in `sh-syntax`
export const MKSH_VARIANT = 4;

export const PRAGMA_PATTERN = /^@(?:format|prettier)/;
