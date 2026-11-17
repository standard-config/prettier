import type { ParserOptions } from 'prettier';
import type {
	ParserDelegation,
	ParserHookName,
	ParserInitializer,
	ParserName,
	ParseWithCompatibility,
	PluginWithParsers,
	ResolvedPriorParser,
} from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
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
});
