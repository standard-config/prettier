import type {
	EditorConfigProperties,
	EditorConfigSection,
	PrettierPlugin,
	PrettierPlugins,
} from './index.d.ts';
import { expectTypeOf, test } from 'vite-plus/test';

test('exposes valid types', () => {
	expectTypeOf<EditorConfigProperties>().toBeObject();
	expectTypeOf<EditorConfigSection>().toBeArray();

	expectTypeOf<PrettierPlugin>().not.toBeAny();
	expectTypeOf<PrettierPlugin>().not.toBeNever();

	expectTypeOf<PrettierPlugins>().toBeArray();
});
