import type { Options, ParserOptions, Plugin } from 'prettier';
import { format } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { expect, test } from 'vite-plus/test';
import findComments from '../find-comments/index.ts';
import moveTrailingComments from './index.ts';

async function getParserOptions(
	text: string,
	options: Options = {}
): Promise<ParserOptions> {
	let parserOptions: ParserOptions | undefined;

	const plugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				preprocess: (code, preprocessOptions) => {
					parserOptions ??= preprocessOptions;
					return code;
				},
			},
		},
	};

	await format(text, { ...options, parser: 'babel', plugins: [plugin] });
	return parserOptions!;
}

async function move(text: string, options: Options = {}): Promise<string> {
	const parserOptions = await getParserOptions(text, {
		printWidth: 20,
		...options,
	});
	const found = await findComments(text, 'babel', parserOptions);

	return moveTrailingComments(text, found, parserOptions, {
		indentations: new Map(),
		keptStarts: new Set(),
	})
		.toSorted((a, b) => a.start - b.start)
		.toReversed()
		.reduce(
			(result, edit) =>
				result.slice(0, edit.start) +
				edit.text +
				result.slice(edit.end),
			text
		);
}

test('moves trailing comments above their lines', async () => {
	await expect(move('foo(); // bar baz qux quux corge\n')).resolves.toBe(
		'// bar baz qux quux\n// corge\nfoo();\n'
	);
	await expect(move('foo(); // bar\nbaz(); // qux\n')).resolves.toBe(
		'// bar\nfoo();\n// qux\nbaz();\n'
	);
});

test('moves comments above lines inside a statement', async () => {
	await expect(move('foo(\n  bar, // baz\n  qux,\n);\n')).resolves.toBe(
		'foo(\n  // baz\n  bar,\n  qux,\n);\n'
	);
});

test('moves comments on closing lines into the block body', async () => {
	await expect(
		move('if (foo) {\n  bar();\n} // baz qux quux corge\n', {
			printWidth: 22,
		})
	).resolves.toBe('if (foo) {\n  bar();\n// baz qux quux\n// corge\n}\n');
});

test('respects `useTabs`', async () => {
	await expect(
		move('if (foo) {\n\tbar();\n} // baz qux quux corge\n', {
			printWidth: 24,
			tabWidth: 4,
			useTabs: true,
		})
	).resolves.toBe('if (foo) {\n\tbar();\n// baz qux quux\n// corge\n}\n');
});

test('moves comments after other comments on their line', async () => {
	await expect(move('foo(/* bar */); // baz\n')).resolves.toBe(
		'// baz\nfoo(/* bar */);\n'
	);
});

test('moves comments after JSX text above the element that holds the text', async () => {
	await expect(move('const foo = <div>\nbar</div>; // baz\n')).resolves.toBe(
		'// baz\nconst foo = <div>\nbar</div>;\n'
	);
	await expect(
		move('const foo = <div>\n{bar // baz\n}\n</div>;\n')
	).resolves.toBe('// baz\nconst foo = <div>\n{bar\n}\n</div>;\n');
	await expect(
		move(
			'const foo = (\n  <div>\n    <b\n    />\n    <i>\n      bar {baz // qux\n      }\n    </i>\n  </div>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  // qux\n  <div>\n    <b\n    />\n    <i>\n      bar {baz\n      }\n    </i>\n  </div>\n);\n'
	);
	await expect(move('const foo = <>\nbar</>; // baz\n')).resolves.toBe(
		'// baz\nconst foo = <>\nbar</>;\n'
	);
	await expect(
		move(
			'const foo = (\n  <Bar>\n    {baz && (\n      <div>\n        qux {quux // corge\n        }\n      </div>\n    )}\n  </Bar>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  <Bar>\n    {baz && (\n      // corge\n      <div>\n        qux {quux\n        }\n      </div>\n    )}\n  </Bar>\n);\n'
	);
});

test('separates comments moved above the same line', async () => {
	await expect(
		move(
			'const foo = (\n  <div>\n    bar {baz // qux\n    }\n    quux {corge // grault\n    }\n  </div>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  // qux\n  //\n  // grault\n  <div>\n    bar {baz\n    }\n    quux {corge\n    }\n  </div>\n);\n'
	);
});

test('moves comments that change lines above next-line directives there', async () => {
	await expect(
		move(
			'const foo = (\n  // eslint-disable-next-line\n  <div>\n    bar {baz // qux\n    }\n  </div>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  // qux\n  // eslint-disable-next-line\n  <div>\n    bar {baz\n    }\n  </div>\n);\n'
	);
	await expect(
		move(
			'const foo = (\n  // bar\n  // eslint-disable-next-line\n  <div>\n    baz {qux // quux\n    }\n    corge {grault // garply\n    }\n  </div>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  // quux\n  //\n  // garply\n  // bar\n  // eslint-disable-next-line\n  <div>\n    baz {qux\n    }\n    corge {grault\n    }\n  </div>\n);\n'
	);
	await expect(
		move(
			'const foo = (\n  <Bar>\n    {baz && ( // eslint-disable-next-line\n      <div>\n        qux {quux // corge\n        }\n      </div>\n    )}\n  </Bar>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  // corge\n  <Bar>\n    {baz && ( /* eslint-disable-next-line */\n      <div>\n        qux {quux\n        }\n      </div>\n    )}\n  </Bar>\n);\n'
	);
});

test('moves comments that change lines below other directives', async () => {
	await expect(
		move(
			'const foo = (\n  //#region\n  <div>\n    bar {baz // qux\n    }\n  </div>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  //#region\n  // qux\n  <div>\n    bar {baz\n    }\n  </div>\n);\n'
	);
	await expect(
		move(
			"const foo = 'bar'; // gitleaks:allow\nconst baz = <div>\n  qux {quux // corge\n}</div>;\n"
		)
	).resolves.toBe(
		"const foo = 'bar'; /* gitleaks:allow */\n// corge\nconst baz = <div>\n  qux {quux\n}</div>;\n"
	);
	await expect(
		move(
			'const foo = (\n  <Bar>\n    {baz && ( // eslint-disable-line\n      <div>\n        qux {quux // corge\n        }\n      </div>\n    )}\n  </Bar>\n);\n'
		)
	).resolves.toBe(
		'const foo = (\n  <Bar>\n    {baz && ( /* eslint-disable-line */\n      // corge\n      <div>\n        qux {quux\n        }\n      </div>\n    )}\n  </Bar>\n);\n'
	);
});

test('turns directives and suppressions into block comments in place', async () => {
	await expect(
		move("foo(); // eslint-disable-line\nbar = 'baz'; // gitleaks:allow\n")
	).resolves.toBe(
		"foo(); /* eslint-disable-line */\nbar = 'baz'; /* gitleaks:allow */\n"
	);
	await expect(
		move("foo(); // pragma: allowlist nextline secret\nbar = 'baz';\n")
	).resolves.toBe(
		"foo(); /* pragma: allowlist nextline secret */\nbar = 'baz';\n"
	);
	await expect(
		move('switch (foo) {\ncase 1:\nbar(); // falls through\ncase 2:\n}\n')
	).resolves.toBe(
		'switch (foo) {\ncase 1:\nbar(); /* falls through */\ncase 2:\n}\n'
	);
	await expect(move('foo(); // eslint-disable-line -- */\n')).resolves.toBe(
		'foo(); // eslint-disable-line -- */\n'
	);
	await expect(move('foo(); /// eslint-disable-line\n')).resolves.toBe(
		'foo(); /// eslint-disable-line\n'
	);
	await expect(
		move(
			'switch (foo) {\ncase 1: {\nbar(); // falls through\n}\ndefault:\n}\n'
		)
	).resolves.toBe(
		'switch (foo) {\ncase 1: {\nbar(); /* falls through */\n}\ndefault:\n}\n'
	);
});

test('moves fall-through comments elsewhere like other comments', async () => {
	await expect(move('foo(); // falls through\nbar();\n')).resolves.toBe(
		'// falls through\nfoo();\nbar();\n'
	);
	await expect(move('foo(); // falls through')).resolves.toBe(
		'// falls through\nfoo();'
	);
});

test('moves comments above clauses that follow other comments', async () => {
	await expect(
		move('switch (foo) {\ncase 1:\nbreak;\n// bar\n\ncase 2: // baz\n}\n')
	).resolves.toBe(
		'switch (foo) {\ncase 1:\nbreak;\n// bar\n\n// baz\ncase 2:\n}\n'
	);
});

test('keeps comments that would change meaning in place', async () => {
	const inputWithDirective = 'foo(); //#region\n';
	const inputWithRangeDirective = 'foo(); // eslint-disable\n';
	const inputWithLegalComment = 'foo(); //! bar\n';
	const inputInTemplate = 'const foo = `bar\nbaz`; // qux\n';
	const inputAfterTemplate = 'const foo = `bar\n`; // baz\n';
	const inputFallThroughOnCase =
		'switch (foo) {\ncase 1:\nbar();\ncase 2: // falls through\n}\n';
	const inputBelowFallThrough =
		'switch (foo) {\ncase 1:\nbar();\n// falls through\n\ncase 2: // baz\n}\n';
	const inputBelowBlockFallThrough =
		'switch (foo) {\ncase 1: {\nbar(); /* falls through */\n\n} // baz\ndefault:\n}\n';
	const inputAfterBlockDirective = '/* @ts-expect-error */\nfoo(); // bar\n';
	const inputAfterLineDirective =
		'// eslint-disable-next-line\nfoo(); // bar\n';
	const inputAfterMultiLineDirective =
		'/* eslint-disable-next-line\n  no-console */\nfoo(); // bar\n';
	const inputAfterOpenDirective =
		'/*\neslint-disable-next-line no-console\n*/\nfoo(); // bar\n';
	const inputBelowNoSemgrep = '// nosemgrep: foo\nbar(); // baz\n';
	const inputBelowAllowlist =
		'// pragma: allowlist nextline secret\nfoo = bar; // baz\n';
	const inputAfterTrailingBlockDirective =
		'foo(); /* eslint-disable-next-line\n  no-console */\nbar(); // baz\n';
	const inputEmpty = '// foo\nbar(); //\n';
	const inputLegalSuppression = 'foo(); //! bar gitleaks:allow\n';
	const inputSuppressionInTemplate =
		'const foo = `bar\nbaz`; // eslint-disable-line\n';

	await expect(move(inputWithDirective)).resolves.toBe(inputWithDirective);
	await expect(move(inputWithRangeDirective)).resolves.toBe(
		inputWithRangeDirective
	);
	await expect(move(inputWithLegalComment)).resolves.toBe(
		inputWithLegalComment
	);
	await expect(move(inputInTemplate)).resolves.toBe(inputInTemplate);
	await expect(move(inputAfterTemplate)).resolves.toBe(inputAfterTemplate);
	await expect(move(inputFallThroughOnCase)).resolves.toBe(
		inputFallThroughOnCase
	);
	await expect(move(inputBelowFallThrough)).resolves.toBe(
		inputBelowFallThrough
	);
	await expect(move(inputBelowBlockFallThrough)).resolves.toBe(
		inputBelowBlockFallThrough
	);
	await expect(move(inputAfterBlockDirective)).resolves.toBe(
		inputAfterBlockDirective
	);
	await expect(move(inputAfterLineDirective)).resolves.toBe(
		inputAfterLineDirective
	);
	await expect(move(inputAfterMultiLineDirective)).resolves.toBe(
		inputAfterMultiLineDirective
	);
	await expect(move(inputAfterOpenDirective)).resolves.toBe(
		inputAfterOpenDirective
	);
	await expect(move(inputBelowNoSemgrep)).resolves.toBe(inputBelowNoSemgrep);
	await expect(move(inputBelowAllowlist)).resolves.toBe(inputBelowAllowlist);
	await expect(move(inputAfterTrailingBlockDirective)).resolves.toBe(
		inputAfterTrailingBlockDirective
	);
	await expect(move(inputEmpty)).resolves.toBe(inputEmpty);
	await expect(move(inputLegalSuppression)).resolves.toBe(
		inputLegalSuppression
	);
	await expect(move(inputSuppressionInTemplate)).resolves.toBe(
		inputSuppressionInTemplate
	);
	await expect(
		move('foo(); // eslint-disable-next-line\nbar(); // baz\n')
	).resolves.toBe('foo(); /* eslint-disable-next-line */\nbar(); // baz\n');
});
