/**
 * Appends underscores until the text no longer contains the mark prefix.
 */
export default function createMarkPrefix(text: string, prefix: string): string {
	let markPrefix = prefix;

	while (text.includes(markPrefix)) {
		markPrefix += '_';
	}

	return markPrefix;
}
