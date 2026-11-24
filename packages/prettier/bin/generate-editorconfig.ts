import type {
	EditorConfigProperties,
	EditorConfigSection,
} from '@standard-config/utilities/types';
import createGlobSet from '@standard-config/utilities/create-glob-set';
import assert from 'node:assert/strict';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import * as pluginShell from 'prettier-plugin-shell';
import BASE_CONFIG from '../src/base-config/index.ts';
import {
	GLOB_SET_MARKDOWN,
	GLOB_SET_MDX,
	GLOB_SET_SHELL,
	GLOB_SET_SHELL_HOOKS,
	GLOB_SET_YAML,
} from '../src/constants/index.ts';

const { shTabWidth, shUseTabs, tabWidth, useTabs } = BASE_CONFIG;
const shellOptions = pluginShell.options!;

/**
 * The `[*]` section mirrors Prettier’s global indentation options.
 */
const defaults: EditorConfigProperties = {
	/* oxlint-disable-next-line unicorn/text-encoding-identifier-case */
	charset: 'utf-8',
	end_of_line: 'lf',
	indent_size: tabWidth!,
	indent_style: useTabs ? 'tab' : 'space',
	insert_final_newline: true,
	trim_trailing_whitespace: true,
};

/**
 * The shell plugin indents every file it formats with its own options.
 */
const shellIndentation: EditorConfigProperties = {
	indent_size: Number(shTabWidth ?? shellOptions.shTabWidth!.default),
	indent_style:
		(shUseTabs ?? shellOptions.shUseTabs!.default) ? 'tab' : 'space',
};

/**
 * Sections are in alphabetical order by label, and the hand-written ones only
 * include the properties that differ from `[*]`.
 */
const sections: EditorConfigSection[] = [
	[
		'Markdown',
		createGlobSet(GLOB_SET_MARKDOWN, GLOB_SET_MDX),
		{
			indent_style: 'space',
		},
	],
	['Shell', GLOB_SET_SHELL, shellIndentation],
	['Shell hooks', GLOB_SET_SHELL_HOOKS, shellIndentation],
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

const content = `${['root = true', formatSection(['*'], defaults), ...formattedSections].join('\n\n')}\n`;
const file = new URL('../../../.editorconfig', import.meta.url);

if (process.argv.includes('--check')) {
	assert.ok(lstatSync(file).isFile());
	assert.equal(readFileSync(file, 'utf8'), content);
} else {
	writeFileSync(file, content);
}

/**
 * Formats glob patterns and their properties as an EditorConfig section.
 */
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

/**
 * Returns a single glob unchanged or groups multiple globs in braces.
 */
function formatSectionHeading(patterns: ReadonlyArray<string>): string {
	if (patterns.length === 1) {
		return patterns[0]!;
	}

	return `{${patterns.join(',')}}`;
}
