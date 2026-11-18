import type {
	CommentBlockOptions,
	CommentSyntax,
	EditorConfigProperties,
	EditorConfigSection,
	PrettierPlugin,
	PrettierPlugins,
} from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
	expectTypeOf<CommentBlockOptions>().toEqualTypeOf<{
		indentation: string;
		joinLines: boolean;
		printWidth: number;
		syntax: CommentSyntax;
		tabWidth: number;
	}>();

	expectTypeOf<CommentSyntax>().toEqualTypeOf<{
		marker: string;
		isBlockKept: (line: string) => boolean;
		isDirective: (text: string) => boolean;
		isUnsafeLineStart: (word: string) => boolean;
	}>();

	expectTypeOf<EditorConfigProperties>().toBeObject();
	expectTypeOf<EditorConfigSection>().toBeArray();

	expectTypeOf<PrettierPlugin>().not.toBeAny();
	expectTypeOf<PrettierPlugin>().not.toBeNever();

	expectTypeOf<PrettierPlugins>().toBeArray();
});
