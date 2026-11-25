import type { ParserOptions, Options as PrettierOptions } from 'prettier';
import type {
	CommentEdit,
	Conversion,
	OxcLanguage,
	OxcNode,
	ParserDelegation,
	ParserHookName,
	ParserInitializer,
	ParserName,
	ParseWithCompatibility,
	PluginOptions,
	PluginWithParsers,
	ResolvedPriorParser,
	TextEdit,
	TextRange,
} from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
	expectTypeOf<CommentEdit>().toEqualTypeOf<
		TextEdit & { conversions: Conversion[]; movedLine?: number }
	>();

	expectTypeOf<Conversion>().toEqualTypeOf<{
		isTrailing: boolean;
		line: number;
		start: number;
	}>();

	expectTypeOf<OxcLanguage>().toEqualTypeOf<'js' | 'ts'>();

	expectTypeOf<OxcNode>().toEqualTypeOf<{
		[key: string]: unknown;
		end: number;
		start: number;
		type: string;
	}>();

	expectTypeOf<ParserDelegation>().toEqualTypeOf<{
		hook: ParserHookName;
		parserName: ParserName;
		resolveNext: () => Promise<ResolvedPriorParser | undefined>;
	}>();

	expectTypeOf<ParserHookName>().toEqualTypeOf<'parse' | 'preprocess'>();

	expectTypeOf<ParserInitializer>().toBeFunction();

	expectTypeOf<ParserName>().toEqualTypeOf<
		'babel' | 'oxc' | 'oxc-ts' | 'typescript'
	>();

	expectTypeOf<ParseWithCompatibility>().toBeFunction();

	expectTypeOf<PluginOptions>()
		.toHaveProperty('tsCommentWrap')
		.toEqualTypeOf<'all' | 'full-line' | 'none' | undefined>();

	expectTypeOf<PluginWithParsers>().toBeObject();
	expectTypeOf<PluginWithParsers>().toHaveProperty('parsers');

	expectTypeOf<ResolvedPriorParser>().toBeObject();
	expectTypeOf<
		Pick<ResolvedPriorParser, 'delegation' | 'entryOptions'>
	>().toEqualTypeOf<{
		delegation?: ParserDelegation;
		entryOptions?: Pick<ParserOptions, 'locEnd' | 'locStart' | 'plugins'>;
	}>();
	expectTypeOf<ResolvedPriorParser>().toHaveProperty('lifecycleState');
	expectTypeOf<ResolvedPriorParser>().toHaveProperty('parser');
	expectTypeOf<ResolvedPriorParser>().toHaveProperty('plugins');

	expectTypeOf<TextEdit>().toEqualTypeOf<{
		end: number;
		source?: TextRange;
		start: number;
		text: string;
	}>();

	expectTypeOf<TextRange>().toEqualTypeOf<{ end: number; start: number }>();
});

test('extends Prettier’s `Options`', () => {
	expectTypeOf<PrettierOptions>().toBeObject();
	expectTypeOf<PrettierOptions>().toHaveProperty('useTabs');

	expectTypeOf<PrettierOptions>()
		.toHaveProperty('tsCommentWrap')
		.toEqualTypeOf<'all' | 'full-line' | 'none' | undefined>();
});
