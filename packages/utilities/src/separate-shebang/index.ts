/**
 * Adds an empty line after a shebang and any `#!` lines right below it when
 * code or a comment follows them directly.
 */
export default function separateShebang(text: string): string {
	return text.replace(/^((?:#![^\n]*\n)+)(?!#!|$|\n)/, '$1\n');
}
