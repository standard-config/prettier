import type { TextEdit } from '../types/index.d.ts';

/**
 * Maps a cursor offset through edits ordered by their starting positions in the
 * original text. Within an edit, it preserves the cursor’s place among the
 * characters of the comment text, leaving out whitespace and comment markers.
 */
export default function mapCursor(
	text: string,
	edits: ReadonlyArray<TextEdit>,
	cursorOffset: number
): number {
	let shift = 0;

	for (const edit of edits) {
		const { source } = edit;

		// A cursor in text that an edit moves follows that text
		if (
			source &&
			cursorOffset >= source.start &&
			cursorOffset <= source.end
		) {
			return (
				edit.start +
				shift +
				findOffset(
					text.slice(source.start, source.end),
					edit.text,
					cursorOffset - source.start
				)
			);
		}

		// A cursor where text is inserted stays after the inserted text
		if (
			cursorOffset < edit.start ||
			(cursorOffset === edit.start && edit.end > edit.start)
		) {
			break;
		}

		if (cursorOffset < edit.end) {
			return (
				edit.start +
				shift +
				findOffset(
					text.slice(edit.start, edit.end),
					edit.text,
					cursorOffset - edit.start
				)
			);
		}

		shift += edit.text.length - (edit.end - edit.start);
	}

	return cursorOffset + shift;
}

/**
 * Finds the offset in the edited text that matches an offset in the original
 * text. After a character of the comment text, it stays after the same
 * character. Elsewhere, or when the edited text lacks that character, it moves
 * before the next one, or to the end of the edited text if none remains.
 */
function findOffset(
	originalText: string,
	editedText: string,
	offset: number
): number {
	const originalOffsets = getTextOffsets(originalText);
	const editedOffsets = getTextOffsets(editedText);
	const count = originalOffsets.filter((index) => index < offset).length;

	const editedOffset = editedOffsets[count - 1];

	if (
		editedOffset !== undefined &&
		originalOffsets[count - 1] === offset - 1
	) {
		return editedOffset + 1;
	}

	return editedOffsets[count] ?? editedText.length;
}

/**
 * Returns the offsets of the characters of the comment text, leaving out
 * whitespace and the markers that start and end comment lines.
 */
function getTextOffsets(text: string): number[] {
	const offsets: number[] = [];
	let lineStart = 0;

	for (const line of text.split('\n')) {
		const [prefix] = /^[ \t]*(?:\/\*+|\*(?!\/)|\/+)?/.exec(line)!;

		// Only lines of block comments end with a marker
		const [suffix = ''] = prefix.trimStart().startsWith('//')
			? []
			: (/\*\/[ \t]*$/.exec(line) ?? []);

		for (
			let index = prefix.length;
			index < line.length - suffix.length;
			index += 1
		) {
			if (!/\s/.test(line[index]!)) {
				offsets.push(lineStart + index);
			}
		}

		lineStart += line.length + 1;
	}

	return offsets;
}
