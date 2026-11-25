import { expect, test } from 'vite-plus/test';
import findFirstDifferentLine from './index.ts';

test('finds the first line that differs', () => {
	expect(
		findFirstDifferentLine('foo;\nbar;\n', 'foo;\nbaz;\n')
	).toStrictEqual({ line: 2, otherTextLine: 'baz;', textLine: 'bar;' });
});

test('finds the first line where one text ends before the other', () => {
	expect(findFirstDifferentLine('foo;\n', 'foo;\n\nbar;\n')).toStrictEqual({
		line: 3,
		otherTextLine: 'bar;',
		textLine: undefined,
	});
	expect(findFirstDifferentLine('foo;\n\nbar;\n', 'foo;\n')).toStrictEqual({
		line: 3,
		otherTextLine: undefined,
		textLine: 'bar;',
	});
});

test('finds no line in identical texts', () => {
	expect(findFirstDifferentLine('foo;\n', 'foo;\n')).toBeUndefined();
});
