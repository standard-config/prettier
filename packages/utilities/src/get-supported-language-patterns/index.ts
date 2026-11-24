import { getSupportInfo } from 'prettier';
import createGlobSet from '../create-glob-set/index.ts';

const { languages: LANGUAGES } = await getSupportInfo();

/**
 * Converts built-in Prettier language names to `overrides.files` patterns for
 * their extensions and file names.
 */
export default function getSupportedLanguagePatterns(
	...names: ReadonlyArray<string>
): string[] {
	const patterns: string[] = [];

	for (const name of names) {
		const language = LANGUAGES.find((entry) => entry.name === name);

		if (!language) {
			throw new Error(
				`Standard Config error: expected Prettier to provide support for the \`${name}\` language`
			);
		}

		// Prettier defines `extensions` for every built-in language
		for (const extension of language.extensions!) {
			patterns.push(`*${extension}`);
		}

		patterns.push(...(language.filenames ?? []));
	}

	return createGlobSet(patterns);
}
