import type {
	CommentBlockOptions,
	CommentSyntax,
} from '@standard-config/utilities/types';
import formatCommentBlock, {
	fillCommentText,
	findFencedLines,
} from '@standard-config/utilities/format-comment-block';
import {
	hasPhysicalLineSuppression,
	hasPhysicalNextLineSuppression,
} from '@standard-config/utilities/line-suppressions';
import {
	BLOCK_DIRECTIVE_PATTERN,
	COVERAGE_RANGE_PATTERN,
} from '../constants/index.ts';
import {
	hasLineSensitiveMarker,
	hasSonarMarker,
} from '../create-comment-syntax/index.ts';

type BlockCommentOptions = {
	indentation: string;
	keepFirstLine?: boolean;
	printWidth: number;
	tabWidth: number;
};

type Section = {
	lines: string[];
	tag?: string;
};

// Vitest strips the comment delimiters before reading these hints
const COVERAGE_HINT_PATTERN =
	/^\s*(?:c8|istanbul|v8)\s+ignore\s+(?:else|file|if|next)(?=\W|$)/;

const COVERAGE_HINT_PREFIX_PATTERN = /^(?:c8|istanbul|v8)[ \t]+ignore\b/;

const DOC_SYNTAX = {
	hasLineSensitiveMarker: hasBlockLineSensitiveMarker,
	isBlockKept: () => false,
	isDirective: () => false,
	isLineKept: (texts, index, lines) =>
		hasPhysicalNextLineSuppression(lines[index - 1] ?? '') ||
		isMarkdownBlock(texts, index),
	// At the start of a line, these words can turn prose into a block tag,
	// Markdown quote, heading, or rule
	isUnsafeLineStart: (word) =>
		/^(?:#{1,6}$|>|@|[-=]+$|\*{3,}$|_{3,}$)/.test(word) ||
		hasPhysicalLineSuppression(`* ${word}`),
	isUnsafeParagraphStart: () => false,
	isUnsafeReflow: (lines) =>
		lines.some(
			(line) =>
				COVERAGE_RANGE_PATTERN.test(line) ||
				hasPhysicalLineSuppression(line)
		),
	marker: '*',
} satisfies CommentSyntax;

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

// v8-to-istanbul reads these markers with the literal `/* ` opener
const RANGE_OPENER_PATTERN = /^\/\* [cv]8 ignore (?:start|stop)/;

// Deno and TSLint read the directive from the raw comment body
const RAW_LINT_DIRECTIVE_PATTERN =
	/^\s*(?:deno-lint-ignore(?=\s|$)|tslint:(?:disable|enable)(?:-(?:line|next-line))?(?=[:\s]|$))/;

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

// v8-to-istanbul also accepts a literal opener followed by this prefix
const V8_NEXT_OPENER_PATTERN = /^\/\* [cv]8 ignore next/;

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
	const firstLine = commentLines[0]!;
	const lastLine = commentLines.at(-1)!;

	// Banners keep their rows of `*`, and TypeScript reads a suppression from
	// the last line of a block comment
	if (
		comment.startsWith('/*!') ||
		comment.startsWith('/***') ||
		comment.endsWith('**/') ||
		/@(?:license|preserve)\b/.test(comment) ||
		/^[ \t]*[*/]*[ \t]*@ts-(?:expect-error|ignore)\b/.test(lastLine) ||
		(!isDocComment && commentLines.length === 1) ||
		commentLines.slice(1).some((line) => !line.trimStart().startsWith('*'))
	) {
		return undefined;
	}

	const contents = getContents(comment, isDocComment);
	const firstContent = contents[0]?.trim() ?? '';
	const rawContent = comment.slice(2, -2);
	const openerContent = isDocComment ? rawContent.slice(1) : rawContent;
	const keptOpener =
		RANGE_OPENER_PATTERN.test(comment) ||
		hasSonarMarker(rawContent) ||
		hasPhysicalLineSuppression(firstLine) ||
		(options.keepFirstLine &&
			openerContent.split('\n', 1)[0]!.trim() !== '')
			? firstLine
			: undefined;

	if (keptOpener !== undefined && commentLines.length === 1) {
		return undefined;
	}

	// Reflow can give prose a directive’s spelling on its first rendered line.
	// Check the raw comment for markers whose readers inspect it directly
	if (
		rawContent.trim() === 'prettier-ignore' ||
		RAW_LINT_DIRECTIVE_PATTERN.test(rawContent) ||
		COVERAGE_HINT_PATTERN.test(openerContent) ||
		V8_NEXT_OPENER_PATTERN.test(comment) ||
		(keptOpener === undefined &&
			BLOCK_DIRECTIVE_PATTERN.test(firstContent) &&
			firstContent !== 'prettier-ignore' &&
			!COVERAGE_HINT_PREFIX_PATTERN.test(firstContent) &&
			COVERAGE_RANGE_PATTERN.exec(firstContent)?.index !== 0) ||
		RULE_SETTING_PATTERN.test(firstContent) ||
		contents.some((content) => PRAGMA_PATTERN.test(content.trimStart()))
	) {
		return undefined;
	}

	// Moving the closer can change how a tool reads or applies a suppression
	const keptCloser =
		hasPhysicalLineSuppression(lastLine) ||
		(lastLine
			.slice(0, -2)
			.replace(/^[ \t]*\*/, '')
			.trim() !== '' &&
			hasPhysicalNextLineSuppression(commentLines.at(-2) ?? ''))
			? ` ${lastLine.trimStart()}`
			: undefined;

	if (keptCloser !== undefined) {
		contents.pop();

		if (contents.length === 0) {
			return undefined;
		}
	}

	const lines: string[] = [];

	if (keptOpener !== undefined) {
		contents.shift();

		if (contents.every((content) => content === '')) {
			return undefined;
		}

		if (contents[0] === '') {
			lines.push('*');
		}
	}

	const blockOptions: CommentBlockOptions = {
		indentation: `${options.indentation} `,
		printWidth: options.printWidth,
		syntax: DOC_SYNTAX,
		tabWidth: options.tabWidth,
	};

	const sections = isDocComment
		? splitSections(contents)
		: [{ lines: contents }];

	for (const [index, section] of sections.entries()) {
		const previousSection = sections[index - 1];
		const previousLine = previousSection
			? toCommentLine(previousSection.lines.at(-1)!)
			: (keptOpener ?? '');
		const followsSuppression = hasPhysicalNextLineSuppression(previousLine);

		if (
			previousSection &&
			section.tag !== previousSection.tag &&
			lines.at(-1) !== '*' &&
			!followsSuppression
		) {
			lines.push('*');
		}

		lines.push(...formatSection(section, blockOptions, followsSuppression));

		if (
			section.lines.at(-1) === '' &&
			hasPhysicalNextLineSuppression(
				toCommentLine(section.lines.findLast((line) => line !== '')!)
			)
		) {
			lines.push('*');
		}
	}

	if (
		keptCloser !== undefined &&
		contents.at(-1) === '' &&
		lines.at(-1) !== '*'
	) {
		lines.push('*');
	}

	return [
		keptOpener ?? (isDocComment ? '/**' : '/*'),
		...(lines.length > 0 ? lines : ['*']).map((line) => ` ${line}`),
		keptCloser ?? ' */',
	].join('\n');
}

/**
 * Checks for a suppression or coverage marker that must stay with its line.
 */
function hasBlockLineSensitiveMarker(line: string): boolean {
	return hasLineSensitiveMarker(line) || hasPhysicalLineSuppression(line);
}

/**
 * Strips comment delimiters and gutters, leaving blank lines as empty strings.
 * Trims outer blank lines except for a trailing line covered by a suppression.
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

	// Drop the closer’s empty line before checking for a suppressed blank line
	if (contents.at(-1) === '') {
		contents.pop();
	}

	while (
		contents.at(-1) === '' &&
		!hasPhysicalNextLineSuppression(toCommentLine(contents.at(-2)!))
	) {
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
	options: CommentBlockOptions,
	followsSuppression: boolean
): string[] {
	if (tag === undefined) {
		return formatBody(
			toCommentLines(contents),
			options,
			followsSuppression
		);
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
	const restLines = toCommentLines(rest);
	const firstLine = toCommentLine(tagLine);
	const firstLineKept =
		followsSuppression || hasBlockLineSensitiveMarker(firstLine);
	const paragraphEnd = firstLineKept
		? 0
		: restTexts.findIndex(
				(text, index) =>
					text === '' ||
					hasBlockLineSensitiveMarker(restLines[index]!) ||
					DOC_SYNTAX.isLineKept(restTexts, index, restLines) ||
					TAG_TEXT_END_PATTERN.test(text)
			);
	const paragraph = paragraphEnd === -1 ? rest : rest.slice(0, paragraphEnd);
	const remainder = paragraphEnd === -1 ? [] : rest.slice(paragraphEnd);

	const [prefix, text] = splitTagText(tag, tagText);
	const formatted = fillCommentText(
		[text, ...paragraph.map((line) => line.trim())].join(' ').trim(),
		prefix === '' ? `* @${tag} ` : `* @${tag} ${prefix} `,
		`*${HANGING_INDENT} `,
		options
	);

	return [
		...(firstLineKept || DOC_SYNTAX.isUnsafeReflow(formatted)
			? toCommentLines([tagLine, ...paragraph])
			: formatted),
		...(remainder.some((line) => line !== '')
			? formatHangingBlock(
					remainder,
					options,
					paragraphEnd === 0 &&
						hasPhysicalNextLineSuppression(firstLine)
				)
			: []),
	];
}

/**
 * Formats the paragraphs and lists that follow the first paragraph of a tag’s
 * text at the tag’s hanging indent, unless their lines mix it with the gutter.
 */
function formatHangingBlock(
	contents: ReadonlyArray<string>,
	options: CommentBlockOptions,
	followsSuppression: boolean
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
	const lines = formatBody(
		toCommentLines(
			indentedCount > 0
				? contents.map((content) =>
						content.slice(HANGING_INDENT.length)
					)
				: contents
		),
		{ ...options, indentation: options.indentation + HANGING_INDENT },
		followsSuppression
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
	return texts.map(toCommentLine);
}

/**
 * Adds the block comment gutter while preserving a tab after it.
 */
function toCommentLine(text: string): string {
	if (text === '') {
		return '*';
	}

	return text.startsWith('\t') ? `*${text}` : `* ${text}`;
}

/**
 * Reflows a body and preserves its first line when it follows a suppression.
 */
function formatBody(
	lines: ReadonlyArray<string>,
	options: CommentBlockOptions,
	followsSuppression: boolean
): string[] {
	const { syntax } = options;
	return formatCommentBlock(lines, {
		...options,
		syntax: followsSuppression
			? {
					...syntax,
					isLineKept: (texts, index, lines) =>
						index === 0 || syntax.isLineKept(texts, index, lines),
				}
			: syntax,
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
