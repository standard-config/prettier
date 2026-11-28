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
		printWidth: number;
		syntax: CommentSyntax;
		tabWidth: number;
	}>();

	expectTypeOf<CommentSyntax>().toEqualTypeOf<{
		marker: string;
		hasLineSensitiveMarker?: (line: string) => boolean;
		isBlockKept: (line: string) => boolean;
		isDirective: (text: string) => boolean;
		isLineKept: (
			texts: ReadonlyArray<string>,
			index: number,
			lines: ReadonlyArray<string>
		) => boolean;
		isUnsafeLineStart: (word: string, isLastWord: boolean) => boolean;
		isUnsafeParagraphStart: (line: string) => boolean;
		isUnsafeReflow?: (lines: ReadonlyArray<string>) => boolean;
	}>();

	expectTypeOf<EditorConfigProperties>().toBeObject();
	expectTypeOf<EditorConfigSection>().toBeArray();

	expectTypeOf<PrettierPlugin>().not.toBeAny();
	expectTypeOf<PrettierPlugin>().not.toBeNever();

	expectTypeOf<PrettierPlugins>().toBeArray();
});
