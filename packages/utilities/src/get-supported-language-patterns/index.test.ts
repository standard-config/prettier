import { expect, test } from 'vite-plus/test';
import getSupportedLanguagePatterns from './index.ts';

test('converts Prettier languages to file patterns', () => {
	expect(getSupportedLanguagePatterns('CSS', 'SCSS')).toStrictEqual(
		expect.arrayContaining(['*.css', '*.scss'])
	);
	expect(getSupportedLanguagePatterns('Markdown')).toStrictEqual(
		expect.arrayContaining(['*.md', 'README'])
	);
	expect(getSupportedLanguagePatterns('Shell')).toStrictEqual(
		expect.arrayContaining(['*.sh', '.bashrc'])
	);
});

test('throws when Prettier doesn’t define a language', () => {
	expect(() =>
		getSupportedLanguagePatterns('Rust')
	).toThrowErrorMatchingInlineSnapshot(
		`[Error: Standard Config error: expected Prettier to provide support for the \`Rust\` language]`
	);
});
