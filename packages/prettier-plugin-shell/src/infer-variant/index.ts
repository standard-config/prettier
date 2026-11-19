import {
	BASH_VARIANT,
	BATS_VARIANT,
	MKSH_VARIANT,
} from '../constants/index.ts';
import isPropertyFile from '../is-property-file/index.ts';

// Like `shfmt`, an extension it recognizes takes precedence over a shebang
const EXTENSION_PATTERN = /\.(bash|bats|mksh|zsh)$/;

// Matches the Bats and mksh shebangs that `shfmt` recognizes
const SHEBANG_PATTERN =
	/^#![ \t]*\/(?:usr\/)?bin\/(?:env[ \t]+)?(bats|mksh)(?:\s|$)/;

// Other shells parse as Bash. POSIX parsing would reject the Bash syntax that
// `sh` scripts often contain, and Zsh support in `mvdan/sh` is experimental
const VARIANTS = new Map([
	['bats', BATS_VARIANT],
	['mksh', MKSH_VARIANT],
]);

/**
 * Infers Bats or mksh from a file’s extension or shebang using `shfmt`’s
 * precedence rules, and uses Bash for other shells and data files.
 */
export default function inferVariant(
	text: string,
	filepath: string | undefined
): number {
	// A `#!` line in a data file is a comment, not a shebang
	if (isPropertyFile(filepath)) {
		return BASH_VARIANT;
	}

	const [, shell = ''] =
		EXTENSION_PATTERN.exec(filepath ?? '') ??
		SHEBANG_PATTERN.exec(text) ??
		[];

	return VARIANTS.get(shell) ?? BASH_VARIANT;
}
