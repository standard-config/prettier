import { basename } from 'node:path';
import { languages } from 'prettier-plugin-sh';

// `prettier-plugin-sh` assigns `.flaskenv` to Shell, but it holds dotenv
// entries
const PROPERTY_FILENAMES = new Set(['.flaskenv']);

// Data formats that `prettier-plugin-sh` also formats, matching the shell
// properties in `@standard-config/prettier`
const PROPERTY_LANGUAGE_NAMES = new Set([
	'CODEOWNERS',
	'dotenv',
	'Git Attributes',
	'hosts',
	'iCalendar',
	'Ignore List',
	'Java Properties',
	'JvmOptions',
	'nvmrc',
	'Option List',
	'pkg-config',
	'TextMate Properties',
	'vCard',
]);

const PROPERTY_LANGUAGES = languages.filter((language) =>
	PROPERTY_LANGUAGE_NAMES.has(language.name)
);

/**
 * Checks whether a path names a data file rather than a shell script, such as
 * an ignore list or a `.env` file.
 */
export default function isPropertyFile(filepath: string | undefined): boolean {
	if (filepath === undefined) {
		return false;
	}

	const name = basename(filepath);

	if (PROPERTY_FILENAMES.has(name)) {
		return true;
	}

	return PROPERTY_LANGUAGES.some(
		({ extensions = [], filenames = [], isSupported }) =>
			filenames.includes(name) ||
			extensions.some((extension) => name.endsWith(extension)) ||
			(isSupported?.({ filepath }) ?? false)
	);
}
