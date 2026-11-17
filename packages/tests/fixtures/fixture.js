let name = '';

for (const param of process.argv.slice(2)) {
	const value = param.replace(/^--name=/, '');

	if (value !== param) {
		name = value;
	}
}

if (!name) {
	console.log('`--name` is missing');
	process.exit(1);
}

console.log(`Name: ${name}`);
