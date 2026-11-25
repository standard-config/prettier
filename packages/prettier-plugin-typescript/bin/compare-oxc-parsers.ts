/**
 * Compares formatted output from Oxc and Prettier’s built-in parsers on
 * JavaScript and TypeScript files in installed dependencies. Sets the exit
 * status to 1 if the outputs differ or only Oxc fails to format a file. Counts
 * built-in parser failures separately.
 */
import type { Options } from 'prettier';
import { globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import createOxcParser from '../src/create-oxc-parser/index.ts';
import findFirstDifferentLine from '../src/find-first-different-line/index.ts';
import { OPTION_SETS } from '../src/oxc-parity-cases/index.ts';

type Outcome = 'different' | 'ownError' | 'referenceError' | 'same';

const MAX_EXAMPLES = 20;

const PLUGIN = {
	parsers: {
		'oxc': createOxcParser('js'),
		'oxc-ts': createOxcParser('ts'),
	},
};

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const files = [
	...new Set(
		globSync('node_modules/.pnpm/**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}', {
			cwd: ROOT,
		})
			.map((file) => realpathSync(`${ROOT}${file}`))
			.filter((file) => statSync(file).isFile())
	),
].toSorted();

const counts: Record<Outcome, number> = {
	different: 0,
	ownError: 0,
	referenceError: 0,
	same: 0,
};
const examples: string[] = [];
const startTime = performance.now();

for (const file of files) {
	const text = readFileSync(file, 'utf8');
	const isTypeScript = /\.[cm]?tsx?$/.test(file);
	const options: Options = { ...OPTION_SETS.config, filepath: file };
	const outcome = await compare(text, isTypeScript, options);

	counts[outcome.type]++;

	if (outcome.detail && examples.length < MAX_EXAMPLES) {
		const label =
			outcome.type === 'ownError'
				? 'Oxc formatting error'
				: 'Different output';
		examples.push(`${label}: ${file}\n  ${outcome.detail}`);
	}
}

process.stdout.write(
	`Checked ${files.length} files in ${Math.round((performance.now() - startTime) / 1000)} s: ${JSON.stringify(counts)}\n`
);

for (const example of examples) {
	process.stdout.write(`${example}\n`);
}

if (counts.different > 0 || counts.ownError > 0) {
	process.exitCode = 1;
}

/**
 * Compares one file using the same formatting options for both parsers.
 */
async function compare(
	text: string,
	isTypeScript: boolean,
	options: Options
): Promise<{ detail?: string; type: Outcome }> {
	let referenceOutput: string;

	try {
		referenceOutput = await format(text, {
			...options,
			parser: isTypeScript ? 'typescript' : 'babel',
		});
	} catch {
		// Output parity applies to code both parsers accept
		return { type: 'referenceError' };
	}

	let output: string;

	try {
		output = await format(text, {
			...options,
			parser: isTypeScript ? 'oxc-ts' : 'oxc',
			plugins: [PLUGIN],
		});
	} catch (error) {
		return {
			detail: (error as Error).message.split('\n')[0],
			type: 'ownError',
		};
	}

	if (output === referenceOutput) {
		return { type: 'same' };
	}

	const { line, otherTextLine, textLine } = findFirstDifferentLine(
		output,
		referenceOutput
	)!;

	return {
		detail: `Line ${line}\n    Built-in: ${describeLine(otherTextLine)}\n    Oxc:      ${describeLine(textLine)}`,
		type: 'different',
	};
}

/**
 * Quotes line text so an empty line stays distinct from the end of the output.
 */
function describeLine(line: string | undefined): string {
	return line === undefined ? '(end of output)' : JSON.stringify(line);
}
