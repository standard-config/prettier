import { PBS_DIRECTIVE_PATTERN } from '../constants/index.ts';

/**
 * Checks whether a backslash continues a PBS directive onto the next line.
 */
export default function hasTrailingDirectiveMarker(
	lines: ReadonlyArray<string>,
	index: number
): boolean {
	for (
		let lineIndex = index;
		lines[lineIndex]?.endsWith('\\');
		lineIndex -= 1
	) {
		if (PBS_DIRECTIVE_PATTERN.test(lines[lineIndex]!)) {
			return true;
		}
	}

	return false;
}
