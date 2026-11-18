import { expect, test } from 'vite-plus/test';
import createMarkPrefix from './index.ts';

test('returns the prefix when the text doesn’t contain it', () => {
	expect(createMarkPrefix('foo', 'mark_')).toBe('mark_');
});

test('extends the prefix until the text doesn’t contain it', () => {
	expect(createMarkPrefix('foo=mark_\nbar=mark__', 'mark_')).toBe('mark___');
});
