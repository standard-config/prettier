import { execFile } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vite-plus/test';

const PRETTIER_BIN = fileURLToPath(
	import.meta.resolve('prettier/bin/prettier.cjs')
);
const TEST_YAML = '{ foo: bar }\n';
const execFileAsync = promisify(execFile);

async function runPrettier(path: string, input: string) {
	const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
	delete env.FORCE_COLOR;
	writeFileSync(path, input);

	return execFileAsync(process.execPath, [PRETTIER_BIN, path], { env });
}

function writeConfig(directory: string, options: object = {}): void {
	const entry = new URL('../../prettier/src/index.ts', import.meta.url).href;
	writeFileSync(
		join(directory, 'prettier.config.mjs'),
		`import { defineConfig } from ${JSON.stringify(entry)};
export default defineConfig(${JSON.stringify(options)});
`
	);
}

test.each([
	{
		filepath: '.releaserc',
		input: '{branches: [main, next]}',
		output: 'branches:\n  - main\n  - next\n',
	},
	{
		filepath: '.releaserc.json',
		input: '{"plugins":["foo","bar"],"branches":["main","next"]}',
		output: '{\n\t"branches": [\n\t\t"main",\n\t\t"next"\n\t],\n\t"plugins": [\n\t\t"foo",\n\t\t"bar"\n\t]\n}\n',
	},
	{
		filepath: 'package.json',
		input: '{"scripts":{"foo":"bar"},"description":"foo","name":"foo","version":"1.0.0"}',
		output: '{\n\t"name": "foo",\n\t"version": "1.0.0",\n\t"description": "foo",\n\t"scripts": {\n\t\t"foo": "bar"\n\t}\n}\n',
	},
])(
	'formats `$filepath` with the resolved config',
	{ timeout: 30_000 },
	async ({ filepath, input, output: expectedOutput }) => {
		using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
		writeConfig(directory.path);
		const path = join(directory.path, filepath);

		const { stdout: output } = await runPrettier(path, input);

		expect(output).toBe(expectedOutput);
		const { stdout: secondPass } = await runPrettier(path, output);
		expect(secondPass).toBe(output);
	}
);

test.each(['foo.json', 'package.json'])(
	'recognizes options from inactive shipped plugins when formatting `%s`',
	async (filepath) => {
		using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
		writeConfig(directory.path, {
			htmlFragmentPrintWidth: 40,
			jsonSortArrays: true,
			packageIgnoreSort: ['foo'],
			shUseTabs: false,
			tsCommentWrap: 'none',
			yamlCollectionStyle: 'block',
		});
		const path = join(directory.path, filepath);
		const input = '{"name":"foo"}';

		const { stderr, stdout } = await runPrettier(path, input);

		expect(stderr).toBe('');
		expect(stdout).toBe('{\n\t"name": "foo"\n}\n');
		const { stdout: secondPass } = await runPrettier(path, stdout);
		expect(secondPass).toBe(stdout);
	}
);

test('recognizes shipped options and warns about unknown options with an empty replacement list', async () => {
	using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
	writeConfig(directory.path, {
		overrides: [
			{
				files: ['foo.yaml'],
				options: { plugins: [], unknownPluginOption: true },
			},
		],
	});
	const path = join(directory.path, 'foo.yaml');

	const { stderr, stdout } = await runPrettier(path, TEST_YAML);

	expect(stderr).toBe(
		'[warn] Ignored unknown option { unknownPluginOption: true }.\n'
	);
	expect(stdout).toBe(TEST_YAML);
});

test('uses the option declaration from a plugin resolved relative to the consumer config', async () => {
	using directory = mkdtempDisposableSync(join(tmpdir(), 'foo-'));
	writeFileSync(
		join(directory.path, 'foo.mjs'),
		`
export const options = {
	yamlCollectionStyle: { category: 'YAML', type: 'choice', choices: [{ value: 'foo' }] },
};
`
	);
	writeConfig(directory.path, {
		overrides: [
			{
				files: ['foo.yaml'],
				options: { plugins: ['./foo.mjs'], yamlCollectionStyle: 'foo' },
			},
		],
	});
	const path = join(directory.path, 'foo.yaml');

	const { stderr, stdout } = await runPrettier(path, TEST_YAML);

	expect(stderr).toBe('');
	expect(stdout).toBe(TEST_YAML);
});
