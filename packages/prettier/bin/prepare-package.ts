import { copyFileSync } from 'node:fs';

for (const file of ['.editorconfig', 'LICENSE', 'README.md']) {
	copyFileSync(
		new URL(`../../../${file}`, import.meta.url),
		new URL(`../${file}`, import.meta.url)
	);
}
