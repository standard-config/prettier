import type { ParserOptions } from 'prettier';
import { format } from 'prettier';
import * as pluginSh from 'prettier-plugin-sh';

/**
 * Finds the lines of printed shell code that hold only a comment, excluding a
 * shebang on the first line.
 */
export default async function findCommentLines(
	lines: ReadonlyArray<string>,
	options: ParserOptions
): Promise<Set<number>> {
	const candidates = lines.flatMap((line, index) =>
		/^[ \t]*#/.test(line) && !(index === 0 && line.startsWith('#!'))
			? [index]
			: []
	);

	if (candidates.length === 0) {
		return new Set();
	}

	// The shell parser doesn’t expose nested comments, so mark each candidate
	// and print without comments. Marks inside heredocs and strings survive.
	// Marking right after `#` keeps line endings and trailing comments intact
	const probePrefix = createProbePrefix(lines);
	const candidateIndexes = new Set(candidates);
	const probe = lines
		.map((line, index) =>
			candidateIndexes.has(index)
				? line.replace('#', `#${probePrefix}${index}_`)
				: line
		)
		.join('\n');

	let printedProbe: string;

	try {
		printedProbe = await format(probe, {
			filepath: options.filepath,
			keepComments: false,
			parser: 'sh',
			plugins: [pluginSh],
			variant: options.variant,
		});
	} catch {
		// A mark can change how a line parses, such as a heredoc delimiter
		// that starts with `#`, so leave every line as printed
		return new Set();
	}

	const markedIndexes = new Set(
		Array.from(
			printedProbe.matchAll(new RegExp(`${probePrefix}(\\d+)_`, 'g')),
			(match) => Number(match[1])
		)
	);

	return new Set(candidates.filter((index) => !markedIndexes.has(index)));
}

/**
 * Returns a mark prefix that the given lines don’t already contain.
 */
function createProbePrefix(lines: ReadonlyArray<string>): string {
	const text = lines.join('\n');
	let prefix = 'prettier_plugin_shell_comments_probe_';

	while (text.includes(prefix)) {
		prefix += '_';
	}

	return prefix;
}
