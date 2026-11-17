import { expect, test } from 'vite-plus/test';
import createMarkPrefix from './index.ts';

test('returns the default prefix when the lines don’t contain it', () => {
	expect(createMarkPrefix(['foo'])).toBe(
		'prettier_plugin_shell_comments_mark_'
	);
});

test('extends the prefix until the lines don’t contain it', () => {
	expect(
		createMarkPrefix([
			'foo=prettier_plugin_shell_comments_mark_',
			'bar=prettier_plugin_shell_comments_mark__',
		])
	).toBe('prettier_plugin_shell_comments_mark___');
});
