import { LangVariant } from 'sh-syntax';

export const BASH_VARIANT = LangVariant.LangBash;

export const BATS_VARIANT = LangVariant.LangBats;

export const DIRECTIVE_PATTERN =
	/^(?:-\*-|bats$|bats[ \t]+file_tags=|bats[ \t]+test_tags=|dotenv-linter:|endregion(?:[ \t]|$)|region(?:[ \t]|$)|shellcheck(?:[ \t]|$)|SPDX-[A-Za-z-]+:|vi:|vim:)/;

export const IGNORE_MARKER_PATTERN = /^#+[ \t]*prettier-ignore$/;

export const LEADING_TRIVIA_LINE_PATTERN = /^[ \t]*(?:#(?<comment>.*)|\\)?$/s;

export const MARK_PREFIX = 'prettier_plugin_shell_mark_';

export const MKSH_VARIANT = LangVariant.LangMirBSDKorn;

// PBS directives, including disabled forms, whose trailing backslash Torque
// reads as a continuation onto the next line
export const PBS_DIRECTIVE_PATTERN = /^[# \t]*PBS[ \t]*["']?-/;

export const PRAGMA_PATTERN = /^@(?:format|prettier)$/;

// Batch scheduler directives for Slurm, PBS, LSF, Grid Engine, and Flux,
// including forms disabled with spaces or more `#` characters
export const SCHEDULER_DIRECTIVE_PATTERN =
	/^[# \t]*(?:(?:BSUB|PBS|SBATCH)[ \t]*["']?-|SBATCH[ \t]+[Hh][Ee][Tt][Jj][Oo][Bb](?:[ \t]|$)|\$[ \t]*-[A-Za-z]|(?:flux|FLUX):)/;
