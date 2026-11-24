import formatCommentBlock from '@standard-config/utilities/format-comment-block';
import { expect, test } from 'vite-plus/test';
import createCommentSyntax from './index.ts';

function formatComment(
	input: string,
	{ isLeading = false, printWidth = 80 } = {}
): string {
	return formatCommentBlock(input.split('\n'), {
		indentation: '',
		printWidth,
		syntax: createCommentSyntax(isLeading),
		tabWidth: 2,
	}).join('\n');
}

test('keeps words that would read as markup with the word before them', () => {
	const options = { printWidth: 13 };

	expect(formatComment('# foo bar baz #qux quux', options)).toBe(
		'# foo bar baz #qux\n# quux'
	);
	expect(formatComment('# foo bar baz shellcheck qux', options)).toBe(
		'# foo bar baz shellcheck\n# qux'
	);
	expect(formatComment('# foo bar baz shellcheck, qux', options)).toBe(
		'# foo bar baz shellcheck,\n# qux'
	);
	expect(formatComment('# foo bar baz prettier-ignore qux', options)).toBe(
		'# foo bar baz prettier-ignore\n# qux'
	);
	expect(formatComment('# foo bar baz c8 ignore', options)).toBe(
		'# foo bar baz c8\n# ignore'
	);
	expect(formatComment('# foo bar baz cspell: qux', options)).toBe(
		'# foo bar baz cspell:\n# qux'
	);
	expect(formatComment('# foo bar baz nosemgrep qux', options)).toBe(
		'# foo bar baz nosemgrep\n# qux'
	);
	expect(formatComment('# foo bar baz SBATCH --qux', options)).toBe(
		'# foo bar baz SBATCH\n# --qux'
	);
	expect(formatComment('# foo bar baz PBS -qux', options)).toBe(
		'# foo bar baz PBS\n# -qux'
	);
	expect(formatComment('# foo bar baz BSUB -qux', options)).toBe(
		'# foo bar baz BSUB\n# -qux'
	);
	expect(formatComment('# foo bar baz $ -qux', options)).toBe(
		'# foo bar baz $\n# -qux'
	);
	expect(formatComment('# foo bar baz $-qux quux', options)).toBe(
		'# foo bar baz $-qux\n# quux'
	);
	expect(formatComment('# foo bar baz SBATCH--qux quux', options)).toBe(
		'# foo bar baz SBATCH--qux\n# quux'
	);
	expect(formatComment('# foo bar baz PBS"-qux quux', options)).toBe(
		'# foo bar baz PBS"-qux\n# quux'
	);
	expect(formatComment('# foo bar baz flux: qux', options)).toBe(
		'# foo bar baz flux:\n# qux'
	);
	expect(formatComment('# foo bar baz FLUX: qux', options)).toBe(
		'# foo bar baz FLUX:\n# qux'
	);
	expect(formatComment('# foo bar baz $- qux', options)).toBe(
		'# foo bar baz\n# $- qux'
	);
	expect(formatComment('# foo bar baz pragma: qux', options)).toBe(
		'# foo bar baz pragma:\n# qux'
	);
	expect(formatComment('# foo bar baz region qux', options)).toBe(
		'# foo bar baz region\n# qux'
	);
	expect(
		formatComment('# foo bar baz SPDX-License-Identifier: MIT', options)
	).toBe('# foo bar baz SPDX-License-Identifier:\n# MIT');
	expect(
		formatComment('# foo bar baz @format qux', {
			...options,
			isLeading: true,
		})
	).toBe('# foo bar baz @format\n# qux');
});

test('keeps the word after a leading marker on its line', () => {
	expect(
		formatComment('# prettier-ignore disables wrapping', { printWidth: 20 })
	).toBe('# prettier-ignore disables\n# wrapping');
	expect(formatComment('# bats foobarbazqux', { printWidth: 12 })).toBe(
		'# bats foobarbazqux'
	);
});

test('keeps lines from joining into a directive', () => {
	const options = { printWidth: 20 };

	expect(formatComment('# c8\n# ignore next', options)).toBe(
		'# c8\n# ignore next'
	);
	expect(
		formatComment('# pragma:\n# allowlist nextline secret', options)
	).toBe('# pragma:\n# allowlist nextline secret');
	expect(formatComment('# pragma:\n# allowlist\n# nextline secret')).toBe(
		'# pragma: allowlist\n# nextline secret'
	);
	expect(
		formatComment('# pragma:  allowlist\n# nextline secret', options)
	).toBe('# pragma: allowlist\n# nextline secret');
	expect(formatComment('# cspell:\n# disable-next-line', options)).toBe(
		'# cspell:\n# disable-next-line'
	);
	expect(formatComment('# SBATCH\n# --time=1', options)).toBe(
		'# SBATCH\n# --time=1'
	);
	expect(formatComment('# $\n# -cwd', options)).toBe('# $\n# -cwd');
	expect(formatComment('# SBATCH\n# hetjob', options)).toBe(
		'# SBATCH\n# hetjob'
	);
	expect(formatComment('# #SBATCH\n# --time=1', options)).toBe(
		'# #SBATCH\n# --time=1'
	);
});

test('keeps lines as written when collapsing their spaces would form a directive', () => {
	expect(formatComment('# pragma:  allowlist nextline secret')).toBe(
		'# pragma:  allowlist nextline secret'
	);
});

test('keeps directives as written', () => {
	const input = '# shellcheck disable=SC2034,SC2086 # foo bar';

	expect(formatComment(input, { printWidth: 20 })).toBe(input);
});

test('separates directives from the rest of the block', () => {
	expect(formatComment('# foo\n# shellcheck disable=SC2034\n# bar')).toBe(
		'# foo\n#\n# shellcheck disable=SC2034\n#\n# bar'
	);
});

test('treats bare `shellcheck` lines and pragmas as directives', () => {
	const options = { isLeading: true };

	expect(formatComment('# shellcheck\n# foo')).toBe('# shellcheck\n#\n# foo');
	expect(formatComment('# foo\n# @format', options)).toBe(
		'# foo\n#\n# @format'
	);
	expect(formatComment('# foo\n# @prettier', options)).toBe(
		'# foo\n#\n# @prettier'
	);
	expect(formatComment('# - foo\n#   @format', options)).toBe(
		'# - foo\n#\n#   @format'
	);
});

test('treats pragmas as text outside the leading comments', () => {
	expect(formatComment('# foo\n# @format')).toBe('# foo @format');
	expect(formatComment('# foo bar baz @format qux', { printWidth: 13 })).toBe(
		'# foo bar baz\n# @format qux'
	);
});

test('treats other tool directives like `shellcheck` directives', () => {
	expect(formatComment('# foo\n# bats test_tags=slow\n# bar')).toBe(
		'# foo\n#\n# bats test_tags=slow\n#\n# bar'
	);
	expect(formatComment('# bats\n# file_tags=slow')).toBe(
		'# bats\n#\n# file_tags=slow'
	);
	expect(formatComment('# foo\n# bats\tfile_tags=slow')).toBe(
		'# foo\n#\n# bats\tfile_tags=slow'
	);
	expect(formatComment('# foo\n# region Helpers\n# bar\n# endregion')).toBe(
		'# foo\n#\n# region Helpers\n#\n# bar\n#\n# endregion'
	);
	expect(formatComment('# foo\n# dotenv-linter:off')).toBe(
		'# foo\n#\n# dotenv-linter:off'
	);
	expect(formatComment('# SPDX-License-Identifier: MIT\n# foo')).toBe(
		'# SPDX-License-Identifier: MIT\n#\n# foo'
	);
	expect(formatComment('# foo\n# vim: set filetype=sh:')).toBe(
		'# foo\n#\n# vim: set filetype=sh:'
	);
	expect(formatComment('# -*- mode: sh -*-\n# foo')).toBe(
		'# -*- mode: sh -*-\n#\n# foo'
	);
});

test('keeps scheduler directives as written', () => {
	const options = { printWidth: 20 };
	const slurm = '#SBATCH --job-name=foo\n#SBATCH --time=01:00:00';
	const pbs = '#PBS -N foo\n#PBS -l walltime=01:00:00';
	const lsf = '#BSUB -J foo\n#BSUB -W 01:00';
	const gridEngine = '#$ -cwd\n#$-N foo';
	const attached = '#SBATCH--time=01:00:00\n#PBS-N foo';
	const quoted = '#SBATCH "--time=01:00:00"\n#SBATCH \'--job-name=foo bar\'';
	const heterogeneousJob =
		'#SBATCH --nodes=1\n#SBATCH hetjob\n#SBATCH --nodes=2\n#SBATCH hetjob # foo\n#SBATCH hetjob --nodes=3';
	const flux =
		'# flux: -N 4\n#FLUX: --queue=batch\n# flux: --setattr=user.conf="""\n# flux:   item = "foo"\n# flux: """';

	expect(formatComment(slurm, options)).toBe(slurm);
	expect(formatComment(pbs, options)).toBe(pbs);
	expect(formatComment(lsf, options)).toBe(lsf);
	expect(formatComment(gridEngine, options)).toBe(gridEngine);
	expect(formatComment(attached, options)).toBe(attached);
	expect(formatComment(quoted, options)).toBe(quoted);
	expect(formatComment(heterogeneousJob, options)).toBe(heterogeneousJob);
	expect(formatComment(flux, options)).toBe(flux);
});

test('keeps disabled scheduler directives as written', () => {
	const input =
		'# SBATCH --time=01:00:00\n##SBATCH --mem=1G\n# $ -cwd\n# #SBATCH --time=01:00:00\n## # PBS -N foo';

	expect(formatComment(input, { printWidth: 20 })).toBe(input);
});

test('keeps lines that continue a PBS directive as written', () => {
	expect(
		formatComment(
			"#PBS -v 'FOO=foo \\\n#bar baz qux \\\n#quux corge'\n# grault garply",
			{ printWidth: 14 }
		)
	).toBe(
		"#PBS -v 'FOO=foo \\\n#bar baz qux \\\n#quux corge'\n# grault\n# garply"
	);
});

test('reflows comments after other scheduler directives that end in a backslash', () => {
	expect(
		formatComment('#SBATCH --time=1 # foo \\\n# bar baz qux quux', {
			printWidth: 14,
		})
	).toBe('#SBATCH --time=1 # foo \\\n# bar baz qux\n# quux');
});

test('wraps comments next to scheduler directives without separating them', () => {
	expect(
		formatComment(
			'# foo bar baz qux\n#SBATCH --job-name=quux\n# corge\n# grault',
			{ printWidth: 14 }
		)
	).toBe('# foo bar baz\n# qux\n#SBATCH --job-name=quux\n# corge grault');
});

test('keeps directives that cover the next line right above it', () => {
	const input =
		'# foo\n# nosemgrep: bar\n# cspell:disable-next-line\n# Bazqux';

	expect(formatComment(input)).toBe(input);
	expect(
		formatComment('# foo\n# pragma: allowlist nextline secret\n#\n# bar')
	).toBe('# foo\n# pragma: allowlist nextline secret\n#\n# bar');
	expect(
		formatComment(
			'# cspell:disable-next-line\n# shellcheck source=./Foo.sh'
		)
	).toBe('# cspell:disable-next-line\n# shellcheck source=./Foo.sh');
	expect(
		formatComment('# nosemgrep: foo\n# bar baz qux quux\n# corge', {
			printWidth: 12,
		})
	).toBe('# nosemgrep: foo\n# bar baz qux quux\n# corge');
});

test('treats lines that only resemble directives as text', () => {
	expect(formatComment('# foo\n# ex: bar')).toBe('# foo ex: bar');
	expect(formatComment('# foo\n# bats bar')).toBe('# foo bats bar');
	expect(formatComment('# foo\n# SBATCH bar')).toBe('# foo SBATCH bar');
	expect(formatComment('# foo\n# $HOME bar')).toBe('# foo $HOME bar');
	expect(formatComment('# foo\n# $- bar')).toBe('# foo $- bar');
	expect(formatComment('# foo\n# SBATCH hetjobs bar')).toBe(
		'# foo SBATCH hetjobs bar'
	);
	expect(formatComment('# foo\n# Flux: bar')).toBe('# foo Flux: bar');
});

test('keeps consecutive directives together', () => {
	const input = '# shellcheck disable=SC2034\n# shellcheck source=foo.sh';

	expect(formatComment(input)).toBe(input);
});

test('keeps blocks that contain `prettier-ignore` as written', () => {
	const input = '# prettier-ignore\n## foo   bar\n#\n#';
	const inputWithLaterIgnore = '# foo   bar\n# prettier-ignore\n## baz';
	const inputWithLooseIgnore = '#prettier-ignore\n#\n## foo   bar';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputWithLaterIgnore)).toBe(inputWithLaterIgnore);
	expect(formatComment(inputWithLooseIgnore)).toBe(inputWithLooseIgnore);
});

test('keeps blocks that contain `#!` lines as written', () => {
	const input = '#! foo   bar\n#  baz\n## qux';
	const inputWithLaterLine = '# foo   bar\n#!baz\n# qux';
	const inputWithEmptyFirstLine = '#\n#!/bin/false';

	expect(formatComment(input)).toBe(input);
	expect(formatComment(inputWithLaterLine)).toBe(inputWithLaterLine);
	expect(formatComment(inputWithEmptyFirstLine)).toBe(
		inputWithEmptyFirstLine
	);
});
