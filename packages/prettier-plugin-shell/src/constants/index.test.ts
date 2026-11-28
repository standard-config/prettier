import { expect, test } from 'vite-plus/test';
import {
	DIRECTIVE_PATTERN,
	IGNORE_MARKER_PATTERN,
	PRAGMA_PATTERN,
	SCHEDULER_DIRECTIVE_PATTERN,
} from './index.ts';

test('matches directives', () => {
	expect('shellcheck disable=SC2086').toMatch(DIRECTIVE_PATTERN);
	expect('shellchecked').not.toMatch(DIRECTIVE_PATTERN);
});

test('matches `prettier-ignore` markers', () => {
	expect('#  prettier-ignore').toMatch(IGNORE_MARKER_PATTERN);
	expect('# prettier-ignore foo').not.toMatch(IGNORE_MARKER_PATTERN);
});

test('matches complete pragma text', () => {
	expect('@format').toMatch(PRAGMA_PATTERN);
	expect('@prettier').toMatch(PRAGMA_PATTERN);
	expect('@formatting').not.toMatch(PRAGMA_PATTERN);
	expect('@prettier foo').not.toMatch(PRAGMA_PATTERN);
	expect('foo @format').not.toMatch(PRAGMA_PATTERN);
});

test('matches scheduler directives', () => {
	expect('SBATCH --time=01:00:00').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('PBS -N foo').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('BSUB -J foo').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('$ -cwd').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('$-cwd').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH--time=01:00:00').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('PBS-N foo').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH "--time=01:00:00"').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect("SBATCH '--job-name=foo'").toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH hetjob').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH hetjob # foo').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH hetjob --nodes=2').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH HETJOB').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH HetJob # foo').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('#SBATCH --time=01:00:00').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('# # PBS -N foo').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('flux: -N 4').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('FLUX: --queue=batch').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('flux:-c2').toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH reads foo').not.toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCHED -N foo').not.toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('$HOME -cwd').not.toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('$- holds the flags').not.toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('SBATCH hetjobs').not.toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('Flux: reads foo').not.toMatch(SCHEDULER_DIRECTIVE_PATTERN);
	expect('foo SBATCH --time=01:00:00').not.toMatch(
		SCHEDULER_DIRECTIVE_PATTERN
	);
});
