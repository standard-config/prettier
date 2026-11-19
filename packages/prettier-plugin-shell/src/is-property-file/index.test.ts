import { expect, test } from 'vite-plus/test';
import isPropertyFile from './index.ts';

test('recognizes data files that `prettier-plugin-sh` formats', () => {
	expect(isPropertyFile('.gitignore')).toBe(true);
	expect(isPropertyFile('foo/.env')).toBe(true);
	expect(isPropertyFile('foo/.env.local')).toBe(true);
	expect(isPropertyFile('.flaskenv')).toBe(true);
	expect(isPropertyFile('CODEOWNERS')).toBe(true);
	expect(isPropertyFile('foo.properties')).toBe(true);
});

test('treats shell scripts and unknown paths as scripts', () => {
	expect(isPropertyFile('foo.sh')).toBe(false);
	expect(isPropertyFile('foo')).toBe(false);
	expect(isPropertyFile(undefined)).toBe(false);
});
