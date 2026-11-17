/**
 * Returns a mark prefix that the given lines don’t already contain.
 */
export default function createMarkPrefix(lines: ReadonlyArray<string>): string {
	const text = lines.join('\n');
	let prefix = 'prettier_plugin_shell_comments_mark_';

	while (text.includes(prefix)) {
		prefix += '_';
	}

	return prefix;
}
