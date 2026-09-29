import createGlobSet from '../create-glob-set/index.ts';
import getSupportedLanguagePatterns from '../get-supported-language-patterns/index.ts';

export const GLOB_SET_CSS = getSupportedLanguagePatterns(
	'CSS',
	'Less',
	'PostCSS',
	'SCSS'
);

export const GLOB_SET_GRAPHQL = getSupportedLanguagePatterns('GraphQL');

export const GLOB_SET_HTML = getSupportedLanguagePatterns(
	'Handlebars',
	'HTML',
	'MJML'
);

export const GLOB_SET_JAVASCRIPT = getSupportedLanguagePatterns(
	'JavaScript',
	'JSX'
);

export const GLOB_SET_JAVASCRIPT_FLOW = getSupportedLanguagePatterns('Flow');

export const GLOB_SET_JSON = getSupportedLanguagePatterns(
	'JSON',
	'JSON with Comments',
	'JSON.stringify'
);

export const GLOB_SET_JSON5 = getSupportedLanguagePatterns('JSON5');

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
		'Dockerfile',
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
	'.env.*',
	'*.Dockerfile'
);

export const GLOB_SET_TYPESCRIPT = getSupportedLanguagePatterns(
	'TSX',
	'TypeScript'
);

export const GLOB_SET_VUE = getSupportedLanguagePatterns('Vue');

export const GLOB_SET_YAML = getSupportedLanguagePatterns('YAML');
