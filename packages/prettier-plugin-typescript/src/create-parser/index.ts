import type { Parser, ParserOptions, Printer } from 'prettier';
import type { ParserName, PluginOptions } from '../types/index.d.ts';
import separateShebang from '@standard-config/utilities/separate-shebang';
import { isFindingComments } from '../find-comments/index.ts';
import {
	callParserWithCompatibility,
	createPriorParserResolver,
	getParserDelegation,
	markParserAsOwn,
	withPriorParserOptions,
} from '../plugin-hooks/index.ts';
import wrapComments from '../wrap-comments/index.ts';

/**
 * Creates a parser that defers to the prior compatible parser before the
 * supplied base parser. After earlier plugins preprocess the source, it reflows
 * comments and separates the shebang before parsing. For invalid input, it
 * preserves the wrapped parser’s syntax error.
 */
export default function createParser(
	name: ParserName,
	baseParser: Parser
): Parser {
	// Save each call’s source after any earlier preprocessing
	const unchangedTexts = new WeakMap<ParserOptions, string>();

	async function parse(
		text: string,
		options: ParserOptions
	): Promise<unknown> {
		try {
			return await parseText(text, options);
		} catch (error) {
			const unchangedText = unchangedTexts.get(options);

			if (unchangedText === undefined || unchangedText === text) {
				throw error;
			}

			// Prettier draws the code frame on its input. Retry the saved
			// source so this plugin’s edits can’t shift the error location
			await parseText(unchangedText, options);

			let message = `[prettier-plugin-typescript] Failed to parse the edited code with \`${name}\`. The parser accepted the code before this plugin changed it`;
			const details = error instanceof Error ? error.message : error;

			if (typeof details === 'string' && details) {
				message += `:\n\n${details}`;
			}

			throw new Error(message, { cause: error });
		}
	}

	async function parseText(
		text: string,
		options: ParserOptions
	): Promise<unknown> {
		const resolvedPriorParser = await resolvePriorParser(options, 'parse');
		const priorParser = resolvedPriorParser?.parser;

		if (
			resolvedPriorParser &&
			priorParser &&
			typeof priorParser.parse === 'function' &&
			priorParser.parse !== parse
		) {
			return withPriorParserOptions(
				options,
				resolvedPriorParser,
				(delegatedOptions) =>
					callParserWithCompatibility(
						priorParser,
						text,
						delegatedOptions
					)
			);
		}

		return await baseParser.parse(text, options);
	}

	const preprocess: NonNullable<Parser['preprocess']> = async (
		text: string,
		options: ParserOptions
	) => {
		// Finding comments runs the formatter on code already preprocessed
		if (isFindingComments()) {
			return text;
		}

		const isPassThrough =
			getParserDelegation(options, 'preprocess', name) !== undefined ||
			isPartialFormat(text, options);
		const resolvedPriorParser = await resolvePriorParser(
			options,
			'preprocess'
		);
		const priorParser = resolvedPriorParser?.parser;
		const priorPreprocess = priorParser?.preprocess;
		const preprocessedText =
			resolvedPriorParser &&
			priorParser &&
			typeof priorPreprocess === 'function' &&
			priorPreprocess !== preprocess
				? await withPriorParserOptions(
						options,
						resolvedPriorParser,
						(delegatedOptions): Promise<string> | string =>
							priorPreprocess.call(
								priorParser,
								text,
								delegatedOptions
							)
					)
				: text;

		if (isPassThrough) {
			return preprocessedText;
		}

		unchangedTexts.set(options, preprocessedText);

		const wrappedText =
			(options as PluginOptions).tsCommentWrap === 'none'
				? preprocessedText
				: await wrapComments(preprocessedText, name, options);

		return separateShebangLine(wrappedText, options);
	};

	const parser: Parser = {
		...baseParser,
		parse,
		preprocess,
	};

	const resolvePriorParser = createPriorParserResolver(
		name,
		baseParser.astFormat,
		parser
	);

	return markParserAsOwn(parser);
}

/**
 * Separates the shebang while keeping the cursor on the same character.
 */
function separateShebangLine(text: string, options: ParserOptions): string {
	const result = separateShebang(text);
	const cursorOffset = options.cursorOffset as number;

	// Prettier reads the cursor position after this step, so it has to point
	// into the returned text
	if (result !== text && cursorOffset > text.indexOf('\n')) {
		options.cursorOffset = cursorOffset + 1;
	}

	return result;
}

/**
 * Returns whether Prettier formats only a range of the code, where a change to
 * the code would shift the range.
 */
function isPartialFormat(text: string, options: ParserOptions): boolean {
	return (
		options.rangeStart > 0 ||
		// Range formatting parses the selected range again as code of its own,
		// while keeping the text of the whole file
		(options.rangeEnd === Number.POSITIVE_INFINITY &&
			options.originalText !== text) ||
		(options.rangeEnd < text.length && !hasInsertedPragma(text, options))
	);
}

/**
 * Returns whether Prettier inserted a pragma into the code after measuring it,
 * which leaves the code longer than its range. A pragma that Prettier merges
 * into an existing docblock isn’t recognized, so this plugin’s changes appear
 * only on the next run.
 */
function hasInsertedPragma(text: string, options: ParserOptions): boolean {
	if (!options.insertPragma || options.requirePragma) {
		return false;
	}

	// A shebang stays before the pragma, so preserve it when reconstructing the
	// measured code
	const [shebang = ''] = /^#!.*\n/.exec(text) ?? [];
	const code =
		shebang + text.slice(text.length - options.rangeEnd + shebang.length);

	return (options.printer as Printer).insertPragma?.(code) === text;
}
