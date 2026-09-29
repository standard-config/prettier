import { expect, test } from 'vite-plus/test';
import createGlobSet from './index.ts';

test('merges glob sets into a sorted set without duplicates', () => {
	expect(
		createGlobSet(['README', '*.md'], ['.bashrc', '*.md', 'contents.lr'])
	).toStrictEqual(['.bashrc', '*.md', 'contents.lr', 'README']);
});
