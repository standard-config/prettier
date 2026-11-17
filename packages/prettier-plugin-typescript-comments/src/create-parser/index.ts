import type { Parser, ParserOptions, Printer } from 'prettier';
import type { ParserName } from '../types/index.d.ts';
import {
	callParserWithCompatibility,
	createPriorParserResolver,
	getParserDelegation,
	markParserAsOwn,
	withPriorParserOptions,
} from '../plugin-hooks/index.ts';
import separateShebang from '../separate-shebang/index.ts';

/**
 * Wraps a parser to separate a shebang from what follows after earlier
 * `preprocess` hooks run and before `parse` runs.
 */
export default function createParser(
	name: ParserName,
	baseParser: Parser
): Parser {
	async function parse(
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

		return isPassThrough
			? preprocessedText
			: separateShebangLine(preprocessedText, options);
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
 * Separates a shebang from what follows, keeping the cursor on the same
 * character.
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
 * Returns whether Prettier formats only a range of the code, where a change
 * to the code would shift the range.
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
 * Returns whether Prettier inserted a pragma into the code after measuring
 * it, which leaves the code longer than its range. A pragma that Prettier
 * merges into an existing docblock isn’t recognized, so the empty line after
 * a shebang appears only on the next run.
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
