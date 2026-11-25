import type { Parser } from 'prettier';
import type { OxcLanguage } from '../types/index.d.ts';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import normalizeOxcAST from '../normalize-oxc-ast/index.ts';
import parseOxc from '../parse-oxc/index.ts';

const { hasIgnorePragma, hasPragma, locEnd, locStart } = babelParsers.babel;

/**
 * Pairs Prettier’s `estree` printer with Oxc for JavaScript or TypeScript.
 */
export default function createOxcParser(language: OxcLanguage): Parser {
	return {
		astFormat: 'estree',
		hasIgnorePragma,
		hasPragma,
		locEnd,
		locStart,
		parse(text, options) {
			const { comments, program } = parseOxc(
				text,
				options.filepath,
				language
			);

			return normalizeOxcAST(program, comments, text, language);
		},
	};
}
