import type {
	EditorConfigProperties,
	EditorConfigSection,
} from '../src/types/index.d.ts';
import { writeFileSync } from 'node:fs';
import {
	GLOB_SET_MARKDOWN,
	GLOB_SET_MDX,
	GLOB_SET_SHELL,
	GLOB_SET_SHELL_HOOKS,
	GLOB_SET_SHELL_PROPERTIES,
	GLOB_SET_YAML,
} from '../src/constants/index.ts';
import createGlobSet from '../src/create-glob-set/index.ts';

/**
 * The `[*]` section mirrors the base indentation options rather than
 * Prettier’s global options, which are reserved for shell scripts.
 */
const defaults: EditorConfigProperties = {
	/* oxlint-disable-next-line unicorn/text-encoding-identifier-case */
	charset: 'utf-8',
	end_of_line: 'lf',
	indent_size: 4,
	indent_style: 'tab',
	insert_final_newline: true,
	trim_trailing_whitespace: true,
};

/**
 * Sections are in alphabetical order by label, and each one only includes the
 * properties that differ from `[*]`.
 */
const sections: EditorConfigSection[] = [
	[
		'Markdown',
		createGlobSet(GLOB_SET_MARKDOWN, GLOB_SET_MDX),
		{
			indent_style: 'space',
		},
	],
	[
		'Shell',
		GLOB_SET_SHELL,
		{
			indent_size: 2,
			indent_style: 'space',
		},
	],
	[
		'Shell hooks',
		GLOB_SET_SHELL_HOOKS,
		{
			indent_size: 2,
			indent_style: 'space',
		},
	],
	[
		'Shell properties',
		GLOB_SET_SHELL_PROPERTIES,
		{
			indent_size: 2,
			indent_style: 'space',
		},
	],
	[
		'YAML',
		GLOB_SET_YAML,
		{
			indent_size: 2,
			indent_style: 'space',
		},
	],
];

const formattedSections = sections.map(
	([label, patterns, properties]) =>
		`# ${label}\n${formatSection(patterns, properties)}`
);

writeFileSync(
	new URL('../.editorconfig', import.meta.url),
	`${['root = true', formatSection(['*'], defaults), ...formattedSections].join('\n\n')}\n`
);

function formatSection(
	patterns: ReadonlyArray<string>,
	properties: EditorConfigProperties
): string {
	const lines = [`[${formatSectionHeading(patterns)}]`];

	for (const [key, value] of Object.entries(properties)) {
		lines.push(`${key} = ${value}`);
	}

	return lines.join('\n');
}

function formatSectionHeading(patterns: ReadonlyArray<string>): string {
	if (patterns.length === 1) {
		return patterns[0]!;
	}

	return `{${patterns.join(',')}}`;
}
