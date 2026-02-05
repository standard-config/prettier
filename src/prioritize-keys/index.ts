/**
 * @deprecated Use an array value for the `jsonSortOrder` property instead.
 */
export default function prioritizeKeys(...keys: ReadonlyArray<string>): string {
	/* oxlint-disable-next-line typescript/no-restricted-types */
	const order: Record<string, null> = {};

	for (const key of keys) {
		order[String(key)] = null;
	}

	return JSON.stringify({
		...order,
		[/.*/ as any]: 'lexical',
	});
}
