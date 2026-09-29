const { compare } = new Intl.Collator('en');

/**
 * Merge glob sets and individual patterns into a single alphabetized set
 * without duplicates.
 */
export default function createGlobSet(
	...globSets: ReadonlyArray<ReadonlyArray<string> | string>
): string[] {
	return [...new Set(globSets.flat())].toSorted(compare);
}
