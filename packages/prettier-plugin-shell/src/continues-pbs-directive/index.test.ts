import { expect, test } from 'vite-plus/test';
import continuesPbsDirective from './index.ts';

test('finds PBS directives that end in a backslash', () => {
	expect(continuesPbsDirective(["#PBS -v 'FOO=foo \\"], 0)).toBe(true);
	expect(continuesPbsDirective(["# PBS -v 'FOO=foo \\"], 0)).toBe(true);
});

test('finds lines that continue PBS directives with a backslash', () => {
	expect(continuesPbsDirective(["#PBS -v 'FOO=foo \\", '#bar \\'], 1)).toBe(
		true
	);
	expect(
		continuesPbsDirective(["#PBS -v 'FOO=foo \\", '#SBATCH --bar \\'], 1)
	).toBe(true);
});

test('ignores other lines that end in a backslash', () => {
	expect(continuesPbsDirective(['#SBATCH --time=1 \\'], 0)).toBe(false);
	expect(continuesPbsDirective(['# foo \\'], 0)).toBe(false);
	expect(continuesPbsDirective(["#PBS -v 'FOO=foo", '#bar \\'], 1)).toBe(
		false
	);
});

test('ignores PBS directives without a backslash', () => {
	expect(continuesPbsDirective(['#PBS -N foo'], 0)).toBe(false);
	expect(continuesPbsDirective(['#PBS -N foo'], 1)).toBe(false);
});
