/**
 * Returns a mark prefix that the text doesn’t contain, adding underscores if
 * needed.
 */
export default function createMarkPrefix(text: string, prefix: string): string {
	let markPrefix = prefix;

	while (text.includes(markPrefix)) {
		markPrefix += '_';
	}

	return markPrefix;
}
