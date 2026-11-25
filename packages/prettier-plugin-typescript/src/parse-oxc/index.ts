import type { Comment, OxcError, ParserOptions } from 'oxc-parser';
import type { OxcLanguage, OxcNode } from '../types/index.d.ts';
import { parseSync } from 'oxc-parser';

type Attempt = Required<Pick<ParserOptions, 'lang' | 'sourceType'>>;

type Diagnostic = Pick<OxcError, 'labels' | 'message'>;

type Position = {
	column: number;
	line: number;
};

// Match the built-in TypeScript parser’s JSX heuristic. In the pattern for
// `/>`, either of the first two characters can be a line break
const JSX_PATTERNS = [/^[^\n"'`]*<\//m, /^[^/][^/].*\/>/m];

// Count line breaks as the built-in parsers do. Direct callers can still supply
// carriage returns, which Prettier normally converts to line feeds
const LINE_BREAK_PATTERN = /\r\n?|[\n\u2028\u2029]/;

// Prettier’s built-in parsers allow top-level `return`
const TOLERATED_ERROR_PATTERN =
	/^A 'return' statement can only be used within a function body\.$/;

/**
 * Returns the program and comments from the first Oxc attempt with no fatal
 * errors. If every attempt fails, reports the first fatal error.
 */
export default function parseOxc(
	text: string,
	filepath: string | undefined,
	language: OxcLanguage
): { comments: Comment[]; program: OxcNode } {
	let firstError: SyntaxError | undefined;

	for (const attempt of getAttempts(text, filepath, language)) {
		const result = parseSync(filepath ?? '', text, {
			...attempt,
			astType: language,
			preserveParens: true,
			showSemanticErrors: false,
		});

		// Outside modules, Oxc can read `<!--` and line-leading `-->` as line
		// comments. The built-in `typescript` parser reads them as operators,
		// so accepting that parse could turn code into a comment
		const htmlComment =
			language === 'ts'
				? result.comments.find((comment) =>
						isHTMLComment(comment, text)
					)
				: undefined;
		const fatalError = result.errors.find(isFatalError);

		if (!htmlComment && !fatalError) {
			return {
				comments: result.comments,
				program: result.program as unknown as OxcNode,
			};
		}

		firstError ??= htmlComment
			? createHTMLCommentError(htmlComment, text)
			: createSyntaxError(fatalError!, text);
	}

	throw firstError!;
}

/**
 * Preserves the Oxc diagnostic as the cause. When present, the first label
 * supplies `loc` and the `(line:column)` suffix on the first line.
 */
export function createSyntaxError(
	error: Diagnostic,
	text: string
): SyntaxError {
	const [label] = error.labels;

	if (!label) {
		return new SyntaxError(error.message, { cause: error });
	}

	const loc = getLocation(text, label);
	const message = error.message.replace(
		/^[^\n]*/,
		(firstLine) => `${firstLine} (${loc.start.line}:${loc.start.column})`
	);

	return Object.assign(new SyntaxError(message, { cause: error }), { loc });
}

/**
 * Reports where Oxc read `<!--` or `-->` as a line comment in TypeScript.
 */
function createHTMLCommentError(comment: Comment, text: string): SyntaxError {
	const label = { end: comment.end, message: null, start: comment.start };
	const loc = getLocation(text, label);
	const delimiter = text.startsWith('<!--', comment.start) ? '<!--' : '-->';
	const diagnostic: Diagnostic = {
		labels: [label],
		message: `[standard-config] Failed to parse TypeScript (${loc.start.line}:${loc.start.column}). The Oxc parser read \`${delimiter}\` as a line comment where TypeScript expects operators`,
	};

	return Object.assign(
		new SyntaxError(diagnostic.message, { cause: diagnostic }),
		{ loc }
	);
}

/**
 * Lists each language’s source types before moving to the next language.
 */
function getAttempts(
	text: string,
	filepath: string | undefined,
	language: OxcLanguage
): Attempt[] {
	const sourceTypes = getSourceTypes(filepath);

	return getLanguages(text, filepath, language).flatMap((lang) =>
		sourceTypes.map((sourceType) => ({ lang, sourceType }))
	);
}

/**
 * Selects JSX for JavaScript. For TypeScript, orders the parsing modes by path
 * and source text to match Prettier’s built-in `typescript` parser.
 */
function getLanguages(
	text: string,
	filepath: string | undefined,
	language: OxcLanguage
): Array<Attempt['lang']> {
	if (language === 'js') {
		return ['jsx'];
	}

	if (filepath !== undefined) {
		// Even `foo.d.css.ts` is a declaration file. Try regular TypeScript too
		// because Prettier accepts implementations in these files
		if (
			/\.d\.[cm]?ts$/.test(filepath) ||
			/\.d\.[^/\\]*\.ts$/.test(filepath)
		) {
			return ['dts', 'ts'];
		}

		// The built-in parser takes the extension from the text after the last
		// dot, or the whole path when it has no dot
		if (/(?:^|\.)[cm]?ts$/i.test(filepath)) {
			return ['ts'];
		}

		// The built-in parser reads TypeScript in JavaScript files with JSX
		if (/(?:^|\.)(?:[cm]?js|jsx|tsx)$/i.test(filepath)) {
			return ['tsx'];
		}
	}

	return JSX_PATTERNS.some((pattern) => pattern.test(text))
		? ['tsx', 'ts']
		: ['ts', 'tsx'];
}

/**
 * Selects module or CommonJS by extension, defaulting to both in that order.
 */
function getSourceTypes(
	filepath: string | undefined
): Array<Attempt['sourceType']> {
	if (filepath !== undefined && /\.m[jt]s$/i.test(filepath)) {
		return ['module'];
	}

	if (filepath !== undefined && /\.c[jt]s$/i.test(filepath)) {
		return ['commonjs'];
	}

	return ['module', 'commonjs'];
}

/**
 * Returns the one-based start and end positions of a label.
 */
function getLocation(
	text: string,
	label: Pick<Diagnostic['labels'][number], 'end' | 'start'>
): { end: Position; start: Position } {
	return {
		end: getPosition(text, label.end),
		start: getPosition(text, label.start),
	};
}

/**
 * Returns the one-based line and column of an offset, as Prettier reports them.
 */
function getPosition(text: string, offset: number): Position {
	const lines = text.slice(0, offset).split(LINE_BREAK_PATTERN);

	return {
		column: lines.at(-1)!.length + 1,
		line: lines.length,
	};
}

/**
 * Checks for an Oxc error other than a top-level `return`.
 */
function isFatalError(error: OxcError): boolean {
	return (
		(error.severity as string) === 'Error' &&
		!TOLERATED_ERROR_PATTERN.test(error.message)
	);
}

/**
 * Checks whether an Oxc line comment starts with an HTML comment delimiter.
 */
function isHTMLComment(comment: Comment, text: string): boolean {
	return comment.type === 'Line' && !text.startsWith('//', comment.start);
}
