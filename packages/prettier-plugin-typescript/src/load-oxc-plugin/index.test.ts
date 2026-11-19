import { expect, onTestFinished, test, vi } from 'vite-plus/test';
import loadOxcPlugin from './index.ts';

test('loads `@prettier/plugin-oxc`', async () => {
	const plugin = await loadOxcPlugin();

	expect(plugin?.parsers).toHaveProperty('oxc');
	expect(plugin?.parsers).toHaveProperty('oxc-ts');
});

test('returns `undefined` when `@prettier/plugin-oxc` fails to load', async () => {
	vi.doMock('@prettier/plugin-oxc', () => {
		throw new Error('foo');
	});

	onTestFinished(() => {
		vi.doUnmock('@prettier/plugin-oxc');
	});

	await expect(loadOxcPlugin()).resolves.toBeUndefined();
});
