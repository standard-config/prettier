/**
 * Adds an empty line after a shebang that code or a comment follows directly.
 */
export default function separateShebang(text: string): string {
	return text.replace(/^(#![^\n]*\n)(?=[^\n])/, '$1\n');
}
