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
const execFileAsync = promisify(execFile);

async function runPrettier(path: string, input: string) {
	writeFileSync(path, input);

	return execFileAsync(process.execPath, [PRETTIER_BIN, path]);
}

function writeConfig(directory: string): void {
	const entry = new URL('../../prettier/src/index.ts', import.meta.url).href;
	writeFileSync(
		join(directory, 'prettier.config.mjs'),
		`import { defineConfig } from ${JSON.stringify(entry)};
export default defineConfig();
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
