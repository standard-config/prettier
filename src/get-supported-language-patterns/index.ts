import { getSupportInfo } from 'prettier';
import { languages as LANGUAGES_PLUGIN_SHELL } from 'prettier-plugin-sh';
import createGlobSet from '../create-glob-set/index.ts';

const { languages: LANGUAGES_CORE } = await getSupportInfo();

const LANGUAGES = [
	/* prettier-ignore */
	...LANGUAGES_CORE,
	...LANGUAGES_PLUGIN_SHELL,
];

/**
 * Convert the extensions and file names Prettier associates with the given
 * languages into `overrides.files` patterns.
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

		for (const extension of language.extensions ?? []) {
			patterns.push(`*${extension}`);
		}

		patterns.push(...(language.filenames ?? []));
	}

	return createGlobSet(patterns);
}
