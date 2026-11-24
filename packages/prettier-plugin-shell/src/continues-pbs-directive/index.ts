import { PBS_DIRECTIVE_PATTERN } from '../constants/index.ts';

/**
 * Checks whether a line ends a PBS directive, or a line that continues one,
 * with a backslash, so Torque reads the next line as part of the directive.
 */
export default function continuesPbsDirective(
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
