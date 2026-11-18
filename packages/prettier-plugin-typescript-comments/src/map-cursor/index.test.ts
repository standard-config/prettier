import { expect, test } from 'vite-plus/test';
import mapCursor from './index.ts';

function applyEdit(input: string, start: number, end: number, text: string) {
	const cursorOffset = input.indexOf('|');
	const original = input.replace('|', '');
	const edited = original.slice(0, start) + text + original.slice(end);
	const offset = mapCursor(original, [{ end, start, text }], cursorOffset);

	return `${edited.slice(0, offset)}|${edited.slice(offset)}`;
}

test('keeps a cursor before an edit in place', () => {
	expect(applyEdit('|foo // bar', 4, 10, '// baz qux')).toBe(
		'|foo // baz qux'
	);
});

test('shifts a cursor after an edit by the change in length', () => {
	expect(applyEdit('// foo\n// bar\n|baz', 0, 13, '// foo bar')).toBe(
		'// foo bar\n|baz'
	);
});

test('keeps a cursor inside an edit after the same character', () => {
	expect(applyEdit('// foo\n// ba|r', 0, 13, '// foo bar')).toBe(
		'// foo ba|r'
	);
	expect(applyEdit('//// fo|o', 0, 8, '// foo')).toBe('// fo|o');
});

test('keeps a cursor between slashes and asterisks of the comment text', () => {
	expect(
		applyEdit('// foo\n// https:/|/bar', 0, 21, '// foo https://bar')
	).toBe('// foo https:/|/bar');
	expect(applyEdit('// foo *|*bar**', 0, 15, '/* foo **bar** */')).toBe(
		'/* foo *|*bar** */'
	);
	expect(applyEdit('// foo */ ba|r', 0, 13, '// foo */\n// bar')).toBe(
		'// foo */\n// ba|r'
	);
});

test('keeps a cursor inside an edit before the same word', () => {
	expect(applyEdit('// foo\n// |bar', 0, 13, '// foo bar')).toBe(
		'// foo |bar'
	);
	expect(applyEdit('// foo |bar', 0, 10, '// foo\n// bar')).toBe(
		'// foo\n// |bar'
	);
});

test('keeps a cursor inside a block comment after the same character', () => {
	expect(
		applyEdit('/*\n * fo|o\n * bar\n */', 0, 20, '/*\n * foo bar\n */')
	).toBe('/*\n * fo|o bar\n */');
});

test('moves a cursor after the comment text to the end of an edit', () => {
	expect(applyEdit('// foo\n/|/', 0, 9, '// foo')).toBe('// foo|');
});

test('leaves a missing cursor missing', () => {
	expect(
		mapCursor('// foo', [{ end: 6, start: 0, text: '// bar' }], -1)
	).toBe(-1);
});
