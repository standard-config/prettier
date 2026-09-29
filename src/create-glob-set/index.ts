const { compare } = new Intl.Collator('en');

/**
 * Merge glob sets into a single alphabetized set without duplicates.
 */
export default function createGlobSet(
	...globSets: ReadonlyArray<ReadonlyArray<string>>
): string[] {
	return [...new Set(globSets.flat())].toSorted(compare);
}
