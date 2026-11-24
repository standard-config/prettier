import createGlobSet from '@standard-config/utilities/create-glob-set';
import getSupportedLanguagePatterns from '@standard-config/utilities/get-supported-language-patterns';

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

export const GLOB_SET_JAVASCRIPT = getSupportedLanguagePatterns(
	'JavaScript',
	'JSX'
);

export const GLOB_SET_JSON = getSupportedLanguagePatterns(
	'JSON',
	'JSON with Comments',
	'JSON.stringify'
);

export const GLOB_SET_MARKDOWN = getSupportedLanguagePatterns('Markdown');

export const GLOB_SET_MDX = getSupportedLanguagePatterns('MDX');

export const GLOB_SET_SHELL = getSupportedLanguagePatterns('Shell');

export const GLOB_SET_SHELL_HOOKS = createGlobSet(
	'**/.hooks/*',
	'**/.husky/*',
	'**/.vite-hooks/*'
);

export const GLOB_SET_SHELL_PROPERTIES = createGlobSet(
	getSupportedLanguagePatterns(
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
		'vCard'
	),
	'.env.*'
);

export const GLOB_SET_TYPESCRIPT = getSupportedLanguagePatterns(
	'TSX',
	'TypeScript'
);

export const GLOB_SET_YAML = getSupportedLanguagePatterns('YAML');
