/**
 * Returns the first differing line from each text with its one-based number.
 * Missing lines and the result for identical texts are `undefined`.
 */
export default function findFirstDifferentLine(
	text: string,
	otherText: string
): { line: number; otherTextLine?: string; textLine?: string } | undefined {
	if (text === otherText) {
		return undefined;
	}

	const lines = text.split('\n');
	const otherLines = otherText.split('\n');
	let index = 0;

	while (lines[index] === otherLines[index]) {
		index++;
	}

	return {
		line: index + 1,
		otherTextLine: otherLines[index],
		textLine: lines[index],
	};
}
