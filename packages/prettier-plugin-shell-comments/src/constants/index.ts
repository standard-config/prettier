export const DIRECTIVE_PATTERN =
	/^(?:-\*-|bats$|bats[ \t]+file_tags=|bats[ \t]+test_tags=|dotenv-linter:|endregion(?:[ \t]|$)|region(?:[ \t]|$)|shellcheck(?:[ \t]|$)|SPDX-[A-Za-z-]+:|vi:|vim:)/;

export const IGNORE_MARKER_PATTERN = /^#+[ \t]*prettier-ignore$/;

export const PRAGMA_PATTERN = /^@(?:format|prettier)/;
