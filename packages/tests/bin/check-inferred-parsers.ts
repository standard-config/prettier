/**
 * Checks parser inference in the built config for JavaScript, TypeScript, Flow,
 * and JSON files. Unit tests exercise the source config directly.
 */
import { defineConfig } from '@standard-config/prettier';
import { getFileInfo } from 'prettier';

const EXPECTED_PARSERS: Record<string, string> = {
	'foo.cjs': 'oxc',
	'foo.cts': 'oxc-ts',
	'foo.d.ts': 'oxc-ts',
	'foo.js': 'oxc',
	'foo.js.flow': 'flow',
	'foo.json': 'json',
	'foo.jsx': 'oxc',
	'foo.mjs': 'oxc',
	'foo.mts': 'oxc-ts',
	'foo.ts': 'oxc-ts',
	'foo.tsx': 'oxc-ts',
};

const { plugins } = defineConfig();
let mismatches = 0;

for (const [filepath, parser] of Object.entries(EXPECTED_PARSERS)) {
	const { inferredParser } = await getFileInfo(filepath, {
		plugins,
		resolveConfig: false,
	});

	if (inferredParser !== parser) {
		mismatches++;
		process.stderr.write(
			`${filepath}: expected \`${parser}\`, inferred \`${String(inferredParser)}\`\n`
		);
	}
}

if (mismatches > 0) {
	process.exitCode = 1;
}
