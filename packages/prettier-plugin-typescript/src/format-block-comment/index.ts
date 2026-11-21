import type {
	CommentBlockOptions,
	CommentSyntax,
} from '@standard-config/utilities/types';
import formatCommentBlock, {
	fillCommentText,
	findFencedLines,
} from '@standard-config/utilities/format-comment-block';
import { BLOCK_DIRECTIVE_PATTERN } from '../constants/index.ts';

type BlockCommentOptions = {
	indentation: string;
	printWidth: number;
	tabWidth: number;
};

type Section = {
	lines: string[];
	tag?: string;
};

const DOC_SYNTAX: CommentSyntax = {
	marker: '*',
	isBlockKept: () => false,
	isDirective: () => false,
	isLineKept: isMarkdownBlock,
	// At the start of a line, these words can turn prose into a block tag,
	// Markdown quote, heading, or rule
	isUnsafeLineStart: (word) =>
		/^(?:#{1,6}$|>|@|[-=]+$|\*{3,}$|_{3,}$)/.test(word),
	isUnsafeParagraphStart: () => false,
};

// Wrapped tag text gets four extra spaces after the usual `* ` prefix,
// following Google’s JavaScript style guide
const HANGING_INDENT = '    ';

// Joining a Markdown heading, quote, or rule with the lines around it would
// change how editors render it
const MARKDOWN_BLOCK_PATTERN =
	/^(?:#{1,6}(?:[ \t]|$)|(?:[*_-][ \t]*){3,}$|>|[-=]+[ \t]*$)/;

const NAMED_TAGS = new Set([
	'arg',
	'argument',
	'callback',
	'param',
	'prop',
	'property',
	'template',
	'typeParam',
	'typedef',
]);

// Reflowing can stop Babel, Flow, Jest, Prettier, or Vitest from recognizing
// these pragmas
const PRAGMA_PATTERN =
	/^@(?:flow|format|jest-environment|jsx(?:Frag|ImportSource|Runtime)?|noflow|noformat|noprettier|prettier|vitest-environment)\b/;

// ESLint rule settings can span several lines in a block comment
const RULE_SETTING_PATTERN = /^eslint(?=[ \t]|$)/;

// A Markdown table’s body can contain rows without a `|` until an empty line or
// another block structure ends it
const TABLE_DELIMITER_PATTERN =
	/^(?=.*\|)\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

// Require a tag boundary to avoid treating `@scope/package` and `@decorator()`
// as block tags
const TAG_PATTERN = /^@([A-Za-z][\w-]*)(?=[\s{]|$)/;

// A list item or a code fence ends the first paragraph of a tag’s text
const TAG_TEXT_END_PATTERN =
	/^(?:(?:[*+-]|\d+[).])(?:[ \t]|$)|`{3,}(?!.*`)|~{3,})/;

/**
 * Formats a block comment on lines of its own, or returns `undefined` when it
 * stays as written.
 */
export default function formatBlockComment(
	comment: string,
	options: BlockCommentOptions
): string | undefined {
	const isDocComment = /^\/\*\*(?![*/])/.test(comment);
	const commentLines = comment.split('\n');

	// Banners keep their rows of `*`, and TypeScript reads a suppression from
	// the last line of a block comment
	if (
		comment.startsWith('/*!') ||
		comment.startsWith('/***') ||
		comment.endsWith('**/') ||
		/@(?:license|preserve)\b/.test(comment) ||
		/^[ \t]*[*/]*[ \t]*@ts-(?:expect-error|ignore)\b/.test(
			commentLines.at(-1)!
		) ||
		(!isDocComment && commentLines.length === 1) ||
		commentLines.slice(1).some((line) => !line.trimStart().startsWith('*'))
	) {
		return undefined;
	}

	const contents = getContents(comment, isDocComment);
	const firstContent = contents[0]?.trim() ?? '';

	// Tools read directives at the start of a block comment and pragmas from
	// any of its lines
	if (
		BLOCK_DIRECTIVE_PATTERN.test(firstContent) ||
		RULE_SETTING_PATTERN.test(firstContent) ||
		contents.some((content) => PRAGMA_PATTERN.test(content.trimStart()))
	) {
		return undefined;
	}

	const blockOptions: CommentBlockOptions = {
		indentation: `${options.indentation} `,
		joinLines: true,
		printWidth: options.printWidth,
		syntax: DOC_SYNTAX,
		tabWidth: options.tabWidth,
	};

	const sections = isDocComment
		? splitSections(contents)
		: [{ lines: contents }];
	const lines: string[] = [];

	for (const [index, section] of sections.entries()) {
		const previousSection = sections[index - 1];

		if (previousSection && section.tag !== previousSection.tag) {
			lines.push('*');
		}

		lines.push(...formatSection(section, blockOptions));
	}

	return [
		isDocComment ? '/**' : '/*',
		...(lines.length > 0 ? lines : ['*']).map((line) => ` ${line}`),
		' */',
	].join('\n');
}

/**
 * Returns comment text without the markers, gutter, or following space,
 * omitting leading and trailing blank lines. Other whitespace-only lines become
 * empty strings.
 */
function getContents(comment: string, isDocComment: boolean): string[] {
	const contents = comment
		.slice(isDocComment ? 3 : 2, -2)
		.split('\n')
		.map((line, index) => {
			const content = (
				index === 0 ? line : line.replace(/^[ \t]*\*/, '')
			).replace(/^ /, '');

			return content.trim() === '' ? '' : content;
		});

	while (contents[0] === '') {
		contents.shift();
	}

	while (contents.at(-1) === '') {
		contents.pop();
	}

	return contents;
}

/**
 * Splits the lines of a doc comment into its description and block tags,
 * skipping code fences.
 */
function splitSections(contents: ReadonlyArray<string>): Section[] {
	const fencedLines = findFencedLines(toCommentLines(contents), '*');
	const sections: Section[] = [{ lines: [] }];

	for (const [index, content] of contents.entries()) {
		const tag = fencedLines.has(index)
			? undefined
			: TAG_PATTERN.exec(content)?.[1];

		if (tag) {
			sections.push({ lines: [content], tag });
		} else {
			sections.at(-1)!.lines.push(content);
		}
	}

	return sections[0]!.lines.length > 0 ? sections : sections.slice(1);
}

/**
 * Returns whether a line resembles a Markdown heading, quote, rule, or table
 * row that joining with surrounding lines could break.
 */
function isMarkdownBlock(texts: ReadonlyArray<string>, index: number): boolean {
	const text = texts[index]!;

	// Code spans and inline tags such as `{@link Foo | label}` can hold a `|`
	// outside a table
	return (
		MARKDOWN_BLOCK_PATTERN.test(text) ||
		text.replaceAll(/`[^`]*`|\{@[^}]*\}/g, '').includes('|') ||
		isInTable(texts, index)
	);
}

/**
 * Returns whether a line is the header row of a Markdown table or follows its
 * delimiter row with no empty line in between.
 */
function isInTable(texts: ReadonlyArray<string>, index: number): boolean {
	if (TABLE_DELIMITER_PATTERN.test(texts[index + 1] ?? '')) {
		return true;
	}

	for (
		let previous = index - 1;
		previous >= 0 && texts[previous] !== '';
		previous -= 1
	) {
		if (TABLE_DELIMITER_PATTERN.test(texts[previous]!)) {
			return true;
		}
	}

	return false;
}

/**
 * Formats the description or one block tag of a comment as lines that start
 * with `*`.
 */
function formatSection(
	{ lines: contents, tag }: Section,
	options: CommentBlockOptions
): string[] {
	if (tag === undefined) {
		return formatCommentBlock(toCommentLines(contents), options);
	}

	const [tagLine = '', ...rest] = contents;

	while (rest.at(-1) === '') {
		rest.pop();
	}

	// Examples hold code
	if (tag === 'example') {
		return toCommentLines([tagLine, ...rest]);
	}

	const tagText = tagLine.slice(tag.length + 1).trim();

	// Content after a tag on a line of its own reads as a block, as with
	// TSDoc’s `@remarks`
	if (tagText === '') {
		return rest.length > 0
			? [
					`* @${tag}`,
					...formatCommentBlock(toCommentLines(rest), options),
				]
			: [`* @${tag}`];
	}

	// A type that continues past the line of its tag keeps its layout
	if (tagText.startsWith('{') && findClosingBracket(tagText) === -1) {
		return toCommentLines([tagLine, ...rest]);
	}

	// JSDoc reads a tag only at the start of a line, so a tag with a later line
	// that looks like a tag after its indentation keeps its layout
	if (rest.some((line) => TAG_PATTERN.test(line.trimStart()))) {
		return toCommentLines([tagLine, ...rest]);
	}

	// A delimiter row right below the tag makes its text a table header, which
	// wrapping would split
	if (TABLE_DELIMITER_PATTERN.test(rest[0]?.trim() ?? '')) {
		return toCommentLines([tagLine, ...rest]);
	}

	const restTexts = rest.map((line) => line.trim());
	const paragraphEnd = restTexts.findIndex(
		(text, index) =>
			text === '' ||
			isMarkdownBlock(restTexts, index) ||
			TAG_TEXT_END_PATTERN.test(text)
	);
	const paragraph = paragraphEnd === -1 ? rest : rest.slice(0, paragraphEnd);
	const remainder = paragraphEnd === -1 ? [] : rest.slice(paragraphEnd);

	const [prefix, text] = splitTagText(tag, tagText);

	return [
		...fillCommentText(
			[text, ...paragraph.map((line) => line.trim())].join(' ').trim(),
			prefix === '' ? `* @${tag} ` : `* @${tag} ${prefix} `,
			`*${HANGING_INDENT} `,
			options
		),
		...(remainder.some((line) => line !== '')
			? formatHangingBlock(remainder, options)
			: []),
	];
}

/**
 * Formats the paragraphs and lists that follow the first paragraph of a tag’s
 * text at the tag’s hanging indent, unless their lines mix it with the gutter.
 */
function formatHangingBlock(
	contents: ReadonlyArray<string>,
	options: CommentBlockOptions
): string[] {
	const nonEmptyContents = contents.filter((content) => content !== '');
	const indentedCount = nonEmptyContents.filter((content) =>
		content.startsWith(HANGING_INDENT)
	).length;

	// Lines that mix the hanging indent with the gutter stay as written, since
	// the extra indentation can be a hanging indent or Markdown nesting
	if (indentedCount > 0 && indentedCount < nonEmptyContents.length) {
		return toCommentLines(contents);
	}

	// Lines that all have the hanging indent lose it while they’re formatted,
	// keeping nested lists and fenced code indented relative to each other
	const lines = formatCommentBlock(
		toCommentLines(
			indentedCount > 0
				? contents.map((content) =>
						content.slice(HANGING_INDENT.length)
					)
				: contents
		),
		{ ...options, indentation: options.indentation + HANGING_INDENT }
	);

	// Formatting removes the empty line that can separate these lines from the
	// tag text. A tab after the gutter follows the hanging indent
	return [
		...(contents[0] === '' ? ['*'] : []),
		...lines.map((line) =>
			line === '*'
				? line
				: `* ${HANGING_INDENT}${line.replace(/^\* ?/, '')}`
		),
	];
}

/**
 * Turns texts into comment lines that start with `*`, leaving an empty text as
 * `*` alone.
 */
function toCommentLines(texts: ReadonlyArray<string>): string[] {
	return texts.map((text) => {
		if (text === '') {
			return '*';
		}

		// A tab after the gutter stays in place of the space
		return text.startsWith('\t') ? `*${text}` : `* ${text}`;
	});
}

/**
 * Splits the text of a block tag into the type and name that stay on its first
 * line and the description that follows them.
 */
function splitTagText(tag: string, tagText: string): [string, string] {
	let rest = tagText;
	const prefixes: string[] = [];

	// The caller keeps tags as written when their type doesn’t close
	if (rest.startsWith('{')) {
		const end = findClosingBracket(rest);

		prefixes.push(rest.slice(0, end + 1));
		rest = rest.slice(end + 1).trimStart();
	}

	if (NAMED_TAGS.has(tag)) {
		const name = findTagName(tag, rest);

		if (name) {
			prefixes.push(name);
			rest = rest.slice(name.length).trimStart();
		}
	}

	return [prefixes.join(' '), rest];
}

/**
 * Returns the name at the start of a block tag’s text, such as an optional name
 * in brackets or the list of type parameters of `@template`.
 */
function findTagName(tag: string, text: string): string {
	if (text.startsWith('[')) {
		const end = findClosingBracket(text);

		if (end !== -1) {
			return text.slice(0, end + 1);
		}
	}

	const pattern = tag === 'template' ? /^[^\s,]+(?:\s*,\s*[^\s,]+)*/ : /^\S+/;

	return pattern.exec(text)?.[0] ?? '';
}

/**
 * Returns the offset of the bracket matching the one at the start of the text,
 * or `-1` if none is found. Skips quoted text without treating escaped quotes
 * as closing quotes.
 */
function findClosingBracket(text: string): number {
	const [opening] = text;
	const closing = opening === '{' ? '}' : ']';
	let depth = 0;
	let quote: string | undefined;

	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];

		if (quote) {
			if (character === '\\') {
				index += 1;
			} else if (character === quote) {
				quote = undefined;
			}
		} else if (
			character === '"' ||
			character === "'" ||
			character === '`'
		) {
			quote = character;
		} else if (character === opening) {
			depth += 1;
		} else if (character === closing) {
			depth -= 1;

			if (depth === 0) {
				return index;
			}
		}
	}

	return -1;
}
