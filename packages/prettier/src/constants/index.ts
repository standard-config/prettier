import createGlobSet from '@standard-config/utilities/create-glob-set';
import getSupportedLanguagePatterns from '@standard-config/utilities/get-supported-language-patterns';
import * as pluginShell from 'prettier-plugin-shell';

export const GLOB_SET_CSS = getSupportedLanguagePatterns(
	'CSS',
	'Less',
	'PostCSS',
	'SCSS'
);

export const GLOB_SET_HTML = getSupportedLanguagePatterns(
	'Handlebars',
	'HTML',
	'MJML'
);

export const GLOB_SET_JSON = getSupportedLanguagePatterns(
	'JSON',
	'JSON with Comments',
	'JSON.stringify'
);

export const GLOB_SET_MARKDOWN = getSupportedLanguagePatterns('Markdown');

export const GLOB_SET_MDX = getSupportedLanguagePatterns('MDX');

// Every extension and file name the shell plugin claims
export const GLOB_SET_SHELL = createGlobSet(
	...pluginShell.languages!.flatMap(({ extensions = [], filenames = [] }) => [
		extensions.map((extension) => `*${extension}`),
		filenames,
	])
);

export const GLOB_SET_SHELL_HOOKS = createGlobSet(
	'**/.hooks/*',
	'**/.husky/*',
	'**/.vite-hooks/*'
);

export const GLOB_SET_YAML = getSupportedLanguagePatterns('YAML');
