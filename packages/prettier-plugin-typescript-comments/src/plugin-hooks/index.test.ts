import type { Parser, ParserOptions, Plugin } from 'prettier';
import type {
	ParserDelegation,
	ParserName,
	ResolvedPriorParser,
} from '../types/index.d.ts';
import * as pluginOxc from '@prettier/plugin-oxc';
import { format, formatWithCursor } from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';
import { parsers as typescriptParsers } from 'prettier/plugins/typescript';
import { expect, test, vi } from 'vite-plus/test';
import * as pluginTypeScriptComments from '../index.ts';
import {
	createPriorParserResolver,
	getParserDelegation,
	withPriorParserOptions,
} from './index.ts';

const JAVASCRIPT_PARSER_NAMES = [
	'babel',
	'oxc',
	'oxc-ts',
	'typescript',
] as const;

const TEST_JAVASCRIPT = 'foo(  bar  )\n';

function getDirectParser(
	plugin: typeof pluginTypeScriptComments,
	parserName: ParserName
): Parser {
	const parser = plugin.parsers?.[parserName];

	if (!parser || typeof parser === 'function') {
		throw new TypeError(`Expected a direct \`${parserName}\` parser`);
	}

	return parser;
}

function createBabelWrapperPlugin(parser: Parser): Plugin {
	return {
		parsers: { babel: parser },
	};
}

function createLocationFunctions(): Pick<Parser, 'locEnd' | 'locStart'> {
	return {
		locEnd: (node) => babelParsers.babel.locEnd(node),
		locStart: (node) => babelParsers.babel.locStart(node),
	};
}

function createRejectionFixture() {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	const delegationKey = Symbol.for(
		'prettier-plugin-typescript-comments.parser-delegation'
	);

	const error = new Error();
	let reject = true;
	let wrapperCallCount = 0;

	const nativeParse = vi.fn((text: string, options: ParserOptions) =>
		babelParsers.babel.parse(text, options)
	);

	const priorPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				parse: nativeParse,
			},
		},
	};

	const wrapperPlugin = createBabelWrapperPlugin({
		...parser,
		parse: async (text, options) => {
			wrapperCallCount += 1;

			if (wrapperCallCount > 3) {
				throw new Error();
			}

			const context: unknown = Reflect.get(options, delegationKey);

			expect(context).toBeDefined();
			expect(context).not.toBe(outerContext);

			await Promise.resolve();
			expect(Reflect.get(options, delegationKey)).toBe(context);

			const ast: unknown = await parser.parse(text, options);

			expect(Reflect.get(options, delegationKey)).toBe(context);

			if (reject) {
				throw error;
			}

			return ast;
		},
	});

	const options = {
		astFormat: parser.astFormat,
		locEnd: parser.locEnd,
		locStart: parser.locStart,
		parser: 'babel',
		plugins: [priorPlugin, wrapperPlugin, pluginTypeScriptComments],
	} as unknown as ParserOptions;

	const outerContext = {
		delegation: {
			hook: 'preprocess',
			parserName: 'babel',
			resolveNext: vi.fn(async () => {
				await Promise.resolve();
				return undefined;
			}),
		},
		snapshot: {
			locEnd: options.locEnd,
			locStart: options.locStart,
			plugins: options.plugins,
		},
		syncOptions: vi.fn(),
	};

	return {
		allowParsing: (): void => {
			reject = false;
		},
		delegationKey,
		error,
		getWrapperCallCount: (): number => wrapperCallCount,
		nativeParse,
		options,
		originalPlugins: options.plugins,
		outerContext,
		parser,
	};
}

test('returns `undefined` without a prior parser', async () => {
	const resolvePriorParser = createPriorParserResolver(
		'babel',
		babelParsers.babel.astFormat,
		getDirectParser(pluginTypeScriptComments, 'babel')
	);

	const options = {
		plugins: [
			null,
			'missing-plugin',
			{ parsers: undefined },
			{ parsers: { babel: undefined } },
		],
	} as unknown as ParserOptions;

	await expect(resolvePriorParser(options, 'parse')).resolves.toBeUndefined();
	await expect(resolvePriorParser(options, 'parse')).resolves.toBeUndefined();
});

test('doesn’t resolve canonical parsers for aliased exports', async () => {
	const currentParser = getDirectParser(
		pluginTypeScriptComments,
		'typescript'
	);
	const initializeCanonicalParser = vi.fn(async (): Promise<Parser> => {
		await Promise.resolve();
		return typescriptParsers.typescript;
	});

	const canonicalPlugin = {
		parsers: { typescript: initializeCanonicalParser },
	} as unknown as Plugin;

	const aliasPlugin: Plugin = {
		parsers: { 'typescript-alias': currentParser },
	};

	const resolvePriorParser = createPriorParserResolver(
		'typescript',
		typescriptParsers.typescript.astFormat,
		currentParser
	);

	const options = {
		parser: 'typescript-alias',
		plugins: [canonicalPlugin, aliasPlugin],
	} as unknown as ParserOptions;

	await expect(resolvePriorParser(options, 'parse')).resolves.toBeUndefined();

	expect(initializeCanonicalParser).not.toHaveBeenCalled();
});

test('preserves the selected parser name between hooks', async () => {
	const currentParser = getDirectParser(pluginTypeScriptComments, 'babel');
	const priorParser: Parser = {
		...babelParsers.babel,
		preprocess: (text) => text,
	};

	const priorPlugin: Plugin = { parsers: { babel: priorParser } };

	const resolvePriorParser = createPriorParserResolver(
		'babel',
		babelParsers.babel.astFormat,
		currentParser
	);

	const options = {
		parser: 'babel',
		plugins: [priorPlugin, pluginTypeScriptComments],
	} as unknown as ParserOptions;

	let result = await resolvePriorParser(options, 'preprocess');

	expect(result?.parser).toBe(priorParser);

	options.parser = 'typescript';

	result = await resolvePriorParser(options, 'parse');

	expect(result?.parser).toBe(priorParser);
});

test('sets and restores prior parser location functions', async () => {
	const currentParser = getDirectParser(pluginTypeScriptComments, 'babel');
	const { locEnd, locStart } = createLocationFunctions();

	const priorParser: Parser = {
		...babelParsers.babel,
		locEnd,
		locStart,
	};

	const plugins: ParserOptions['plugins'] = [];

	const options = {
		astFormat: currentParser.astFormat,
		locEnd: currentParser.locEnd,
		locStart: currentParser.locStart,
		plugins: [pluginTypeScriptComments],
	} as unknown as ParserOptions;

	const originalPlugins = options.plugins;

	const callback = vi.fn(async (delegatedOptions: ParserOptions) => {
		await Promise.resolve();
		expect(delegatedOptions.locEnd).toBe(locEnd);
		expect(delegatedOptions.locStart).toBe(locStart);
	});

	await withPriorParserOptions(
		options,
		{ lifecycleState: {}, parser: priorParser, plugins },
		callback
	);

	expect(callback).toHaveBeenCalledTimes(1);
	expect(options.locEnd).toBe(currentParser.locEnd);
	expect(options.locStart).toBe(currentParser.locStart);
	expect(options.plugins).toBe(originalPlugins);
});

test('doesn’t treat delegated options as entry changes for another hook', async () => {
	const currentParser = getDirectParser(pluginTypeScriptComments, 'babel');
	const priorParser: Parser = {
		...babelParsers.babel,
		locEnd: (node) => babelParsers.babel.locEnd(node),
		locStart: (node) => babelParsers.babel.locStart(node),
		preprocess: (text) => text,
	};

	const priorPlugin: Plugin = {
		parsers: {
			babel: priorParser,
		},
	};

	const resolvePriorParser = createPriorParserResolver(
		'babel',
		babelParsers.babel.astFormat,
		currentParser
	);

	const options = {
		astFormat: currentParser.astFormat,
		locEnd: currentParser.locEnd,
		locStart: currentParser.locStart,
		parser: 'babel',
		plugins: [priorPlugin, pluginTypeScriptComments],
	} as unknown as ParserOptions;

	const originalPlugins = options.plugins;
	const resolvedPriorParser = await resolvePriorParser(options, 'parse');

	expect(resolvedPriorParser?.parser).toBe(priorParser);

	const callback = vi.fn(async (delegatedOptions: ParserOptions) => {
		const resolvedPreprocess = await resolvePriorParser(
			delegatedOptions,
			'preprocess'
		);

		expect(resolvedPreprocess?.parser).toBe(priorParser);
		expect(resolvedPreprocess?.lifecycleState).toStrictEqual({});
	});

	await withPriorParserOptions(options, resolvedPriorParser!, callback);

	expect(callback).toHaveBeenCalledTimes(1);
	expect(options.locEnd).toBe(priorParser.locEnd);
	expect(options.locStart).toBe(priorParser.locStart);
	expect(options.plugins).toBe(originalPlugins);
	expect(resolvedPriorParser?.lifecycleState).toStrictEqual({});
});

test('returns the active delegation only for its hook and parser', async () => {
	const delegation: ParserDelegation = {
		hook: 'preprocess',
		parserName: 'babel',
		resolveNext: vi.fn().mockResolvedValue(undefined),
	};

	const options = {
		plugins: [pluginTypeScriptComments],
	} as unknown as ParserOptions;

	const callback = vi.fn((delegatedOptions: ParserOptions) => {
		expect(
			getParserDelegation(delegatedOptions, 'preprocess', 'babel')
		).toBe(delegation);
		expect(
			getParserDelegation(delegatedOptions, 'parse', 'babel')
		).toBeUndefined();
		expect(
			getParserDelegation(delegatedOptions, 'preprocess', 'typescript')
		).toBeUndefined();
	});

	await withPriorParserOptions(
		options,
		{
			delegation,
			lifecycleState: {},
			parser: babelParsers.babel,
			plugins: [],
		},
		callback
	);

	expect(callback).toHaveBeenCalledTimes(1);
	expect(getParserDelegation(options, 'preprocess', 'babel')).toBeUndefined();
});

test.each(['parse', 'preprocess'] as const)(
	'retains prior parser locations only after `%s` succeeds',
	async (hook) => {
		const currentParser = getDirectParser(
			pluginTypeScriptComments,
			'babel'
		);
		const { locEnd, locStart } = createLocationFunctions();

		const priorParser: Parser = { ...babelParsers.babel, locEnd, locStart };

		const lifecycleState: ResolvedPriorParser['lifecycleState'] = {};
		const plugins: ParserOptions['plugins'] = [pluginTypeScriptComments];

		const options = {
			astFormat: currentParser.astFormat,
			locEnd: currentParser.locEnd,
			locStart: currentParser.locStart,
			plugins,
		} as unknown as ParserOptions;

		const callback = vi.fn(async (delegatedOptions: ParserOptions) => {
			await Promise.resolve();
			expect(delegatedOptions.locEnd).toBe(locEnd);
			expect(delegatedOptions.locStart).toBe(locStart);

			return TEST_JAVASCRIPT;
		});

		await expect(
			withPriorParserOptions(
				options,
				{
					delegation: {
						hook,
						parserName: 'babel',
						resolveNext: vi.fn().mockResolvedValue(undefined),
					},
					lifecycleState,
					parser: priorParser,
					plugins: [],
				},
				callback
			)
		).resolves.toBe(TEST_JAVASCRIPT);

		expect(callback).toHaveBeenCalledTimes(1);
		expect(options.astFormat).toBe(currentParser.astFormat);
		expect(options.locEnd).toBe(
			hook === 'parse' ? locEnd : currentParser.locEnd
		);
		expect(options.locStart).toBe(
			hook === 'parse' ? locStart : currentParser.locStart
		);
		expect(options.plugins).toBe(plugins);
		expect(lifecycleState).toStrictEqual({});
	}
);

test.each(['parse', 'preprocess'] as const)(
	'restores prior parser options when `%s` rejects',
	async (hook) => {
		const currentParser = getDirectParser(
			pluginTypeScriptComments,
			'babel'
		);
		const { locEnd, locStart } = createLocationFunctions();

		const priorParser: Parser = { ...babelParsers.babel, locEnd, locStart };

		const lifecycleState: ResolvedPriorParser['lifecycleState'] = {};
		const plugins: ParserOptions['plugins'] = [pluginTypeScriptComments];

		const options = {
			astFormat: currentParser.astFormat,
			locEnd: currentParser.locEnd,
			locStart: currentParser.locStart,
			plugins,
		} as unknown as ParserOptions;

		const error = new Error();

		const callback = vi.fn(async (delegatedOptions: ParserOptions) => {
			await Promise.resolve();
			expect(delegatedOptions.locEnd).toBe(locEnd);
			expect(delegatedOptions.locStart).toBe(locStart);

			throw error;
		});

		await expect(
			withPriorParserOptions(
				options,
				{
					delegation: {
						hook,
						parserName: 'babel',
						resolveNext: vi.fn().mockResolvedValue(undefined),
					},
					lifecycleState,
					parser: priorParser,
					plugins: [],
				},
				callback
			)
		).rejects.toBe(error);

		expect(callback).toHaveBeenCalledTimes(1);
		expect(options.astFormat).toBe(currentParser.astFormat);
		expect(options.locEnd).toBe(currentParser.locEnd);
		expect(options.locStart).toBe(currentParser.locStart);
		expect(options.plugins).toBe(plugins);
		expect(lifecycleState).toStrictEqual({});
	}
);

test.each(['parse', 'preprocess'] as const)(
	'preserves hook-written lifecycle changes when `%s` rejects',
	async (hook) => {
		const currentParser = getDirectParser(
			pluginTypeScriptComments,
			'babel'
		);
		const { locEnd, locStart } = createLocationFunctions();

		const replacementPlugins: ParserOptions['plugins'] = [];
		const priorParser: Parser = { ...babelParsers.babel, locEnd };
		const lifecycleState: ResolvedPriorParser['lifecycleState'] = {};

		const options = {
			astFormat: currentParser.astFormat,
			locEnd: currentParser.locEnd,
			locStart: currentParser.locStart,
			plugins: [pluginTypeScriptComments],
		} as unknown as ParserOptions;

		const error = new Error();

		await expect(
			withPriorParserOptions(
				options,
				{
					delegation: {
						hook,
						parserName: 'babel',
						resolveNext: vi.fn().mockResolvedValue(undefined),
					},
					lifecycleState,
					parser: priorParser,
					plugins: [],
				},
				async (delegatedOptions) => {
					await Promise.resolve();
					delegatedOptions.locStart = locStart;
					delegatedOptions.plugins = replacementPlugins;

					throw error;
				}
			)
		).rejects.toBe(error);

		expect(options.astFormat).toBe(currentParser.astFormat);
		expect(options.locEnd).toBe(currentParser.locEnd);
		expect(options.locStart).toBe(locStart);
		expect(options.plugins).toBe(replacementPlugins);
		expect(lifecycleState).toStrictEqual({
			locStart,
			plugins: replacementPlugins,
		});
	}
);

test('distinguishes adopted entry locations from explicit resets', async () => {
	const currentParser = getDirectParser(pluginTypeScriptComments, 'babel');
	const { locEnd, locStart } = createLocationFunctions();

	const priorPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				locEnd,
				locStart,
			},
		},
	};

	const resolvePriorParser = createPriorParserResolver(
		'babel',
		babelParsers.babel.astFormat,
		currentParser
	);

	const options = {
		astFormat: currentParser.astFormat,
		locEnd: currentParser.locEnd,
		locStart: currentParser.locStart,
		parser: 'babel',
		plugins: [priorPlugin, pluginTypeScriptComments],
	} as unknown as ParserOptions;

	const resolvedPriorParser = await resolvePriorParser(options, 'parse');

	expect(resolvedPriorParser).toBeDefined();

	await withPriorParserOptions(
		options,
		resolvedPriorParser!,
		() => TEST_JAVASCRIPT
	);

	expect(options.locEnd).toBe(locEnd);
	expect(options.locStart).toBe(locStart);

	const repeatedPriorParser = await resolvePriorParser(options, 'parse');

	expect(repeatedPriorParser).toBe(resolvedPriorParser);
	expect(repeatedPriorParser?.lifecycleState).toStrictEqual({});

	options.locEnd = currentParser.locEnd;
	options.locStart = currentParser.locStart;

	const resetPriorParser = await resolvePriorParser(options, 'parse');

	expect(resetPriorParser).toBe(resolvedPriorParser);
	expect(resetPriorParser?.lifecycleState).toStrictEqual({
		locEnd: currentParser.locEnd,
		locStart: currentParser.locStart,
	});

	await withPriorParserOptions(
		options,
		resetPriorParser!,
		() => TEST_JAVASCRIPT
	);

	expect(options.locEnd).toBe(currentParser.locEnd);
	expect(options.locStart).toBe(currentParser.locStart);
});

test.each(['parse', 'preprocess'] as const)(
	'tracks entry option resets after `%s` rejects',
	async (hook) => {
		const currentParser = getDirectParser(
			pluginTypeScriptComments,
			'babel'
		);
		const { locEnd, locStart } = createLocationFunctions();

		const priorPlugin: Plugin = {
			parsers: {
				babel: {
					...babelParsers.babel,
					preprocess: (text) => text,
				},
			},
		};

		const resolvePriorParser = createPriorParserResolver(
			'babel',
			babelParsers.babel.astFormat,
			currentParser
		);

		const options = {
			astFormat: currentParser.astFormat,
			locEnd: currentParser.locEnd,
			locStart: currentParser.locStart,
			parser: 'babel',
			plugins: [priorPlugin, pluginTypeScriptComments],
		} as unknown as ParserOptions;

		const originalPlugins = options.plugins;
		const reassignedPlugins: ParserOptions['plugins'] = [];
		const resolvedPriorParser = await resolvePriorParser(options, hook);

		expect(resolvedPriorParser).toBeDefined();

		const error = new Error();

		await expect(
			withPriorParserOptions(options, resolvedPriorParser!, async () => {
				await Promise.resolve();

				options.locEnd = locEnd;
				options.locStart = locStart;
				options.plugins = reassignedPlugins;
				throw error;
			})
		).rejects.toBe(error);

		expect(resolvedPriorParser?.entryOptions).toStrictEqual({
			locEnd,
			locStart,
			plugins: reassignedPlugins,
		});

		options.locEnd = currentParser.locEnd;
		options.locStart = currentParser.locStart;
		options.plugins = originalPlugins;

		const resetPriorParser = await resolvePriorParser(options, hook);

		expect(resetPriorParser).toBe(resolvedPriorParser);
		expect(resetPriorParser?.lifecycleState).toStrictEqual({
			locEnd: currentParser.locEnd,
			locStart: currentParser.locStart,
			plugins: originalPlugins,
		});

		await withPriorParserOptions(
			options,
			resetPriorParser!,
			() => TEST_JAVASCRIPT
		);

		expect(options.locEnd).toBe(currentParser.locEnd);
		expect(options.locStart).toBe(currentParser.locStart);
		expect(options.plugins).toBe(originalPlugins);
	}
);

test('respects `cursorOffset` with prior parser locations', async () => {
	const cursorOffset = TEST_JAVASCRIPT.indexOf('bar');
	const locations = new WeakMap<object, { end: number; start: number }>();

	function relocateNodes(value: unknown): void {
		if (!value || typeof value !== 'object') {
			return;
		}

		const node = value as Record<string, unknown>;

		if (typeof node.type === 'string') {
			locations.set(node, {
				end: babelParsers.babel.locEnd(node),
				start: babelParsers.babel.locStart(node),
			});

			node.end = 0;
			node.start = 0;
			node.range = [0, 0];
		}

		for (const child of Object.values(node)) {
			relocateNodes(child);
		}
	}

	const priorPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				locEnd: (node) =>
					locations.get(node)?.end ?? babelParsers.babel.locEnd(node),
				locStart: (node) =>
					locations.get(node)?.start ??
					babelParsers.babel.locStart(node),
				parse: async (text, options) => {
					const ast: unknown = await babelParsers.babel.parse(
						text,
						options
					);

					relocateNodes(ast);
					return ast;
				},
			},
		},
	};

	const { cursorOffset: formattedCursorOffset, formatted } =
		await formatWithCursor(TEST_JAVASCRIPT, {
			cursorOffset,
			parser: 'babel',
			plugins: [priorPlugin, pluginTypeScriptComments],
		});

	expect(formatted).not.toBe(TEST_JAVASCRIPT);
	expect(formatted[formattedCursorOffset]).toBe('b');
	expect(formattedCursorOffset).toBe(formatted.indexOf('bar'));
});

test('preserves plugin lists reassigned by prior parsers', async () => {
	const currentParser = getDirectParser(pluginTypeScriptComments, 'babel');
	const reassignedPlugins: ParserOptions['plugins'] = [];

	const options = {
		astFormat: currentParser.astFormat,
		locEnd: currentParser.locEnd,
		locStart: currentParser.locStart,
		plugins: [pluginTypeScriptComments],
	} as unknown as ParserOptions;

	await withPriorParserOptions(
		options,
		{
			lifecycleState: {},
			parser: babelParsers.babel,
			plugins: [],
		},
		async (delegatedOptions) => {
			await Promise.resolve();
			delegatedOptions.plugins = reassignedPlugins;
		}
	);

	expect(options.plugins).toBe(reassignedPlugins);
});

test.each(JAVASCRIPT_PARSER_NAMES)(
	'matches a single copy’s output alongside an independently loaded copy with the `%s` parser',
	async (parserName) => {
		vi.resetModules();

		const firstPlugin = await import('../index.ts');

		vi.resetModules();

		const secondPlugin = await import('../index.ts');
		const firstParser = getDirectParser(firstPlugin, parserName);
		const secondParser = getDirectParser(secondPlugin, parserName);

		expect(firstParser.parse).not.toBe(secondParser.parse);

		const expectedOutput = await format(TEST_JAVASCRIPT, {
			parser: parserName,
			plugins: [pluginOxc, secondPlugin],
		});
		const output = await format(TEST_JAVASCRIPT, {
			parser: parserName,
			plugins: [pluginOxc, firstPlugin, secondPlugin],
		});

		expect(output).toBe(expectedOutput);
	}
);

test('rejects prior parsers with incompatible AST formats', async () => {
	const customPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				astFormat: 'custom-javascript',
			},
		},
	};

	await expect(
		format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins: [customPlugin, pluginTypeScriptComments],
		})
	).rejects.toThrowErrorMatchingInlineSnapshot(
		`[TypeError: [prettier-plugin-typescript-comments] Unsupported AST format for the \`babel\` parser. Expected \`estree\`, received \`custom-javascript\`]`
	);
});

test('passes compatible options to prior parsers', async () => {
	let observedAstFormat: unknown;
	let observedPlugins: ParserOptions['plugins'] | undefined;
	let observedPrintWidth: number | undefined;

	const observingPlugin: Plugin = {
		parsers: {
			typescript: {
				...typescriptParsers.typescript,
				parse: (text, options) => {
					observedAstFormat = options.astFormat;
					observedPlugins = options.plugins;
					observedPrintWidth = options.printWidth;
					return typescriptParsers.typescript.parse(text, options);
				},
			},
		},
	};

	await format(TEST_JAVASCRIPT, {
		parser: 'typescript',
		plugins: [observingPlugin, pluginTypeScriptComments],
		printWidth: 80,
	});

	expect(observedAstFormat).toBe('estree');
	expect(observedPlugins).toContain(observingPlugin);
	expect(observedPrintWidth).toBe(80);
});

test('shares options between prior `preprocess` and `parse` hooks', async () => {
	const { locEnd, locStart } = createLocationFunctions();

	let observedState: unknown;
	let observedLocEnd: Parser['locEnd'] | undefined;
	let observedLocStart: Parser['locStart'] | undefined;

	const statefulPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				parse: (text, options) => {
					observedState = options.javascriptState;
					observedLocEnd = options.locEnd;
					observedLocStart = options.locStart;
					return babelParsers.babel.parse(text, options);
				},
				preprocess: async (text, options) => {
					await Promise.resolve();
					options.javascriptState = true;
					options.locEnd = locEnd;
					options.locStart = locStart;
					return text;
				},
			},
		},
	};

	await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [statefulPlugin, pluginTypeScriptComments],
	});

	expect(observedState).toBe(true);
	expect(observedLocEnd).toBe(locEnd);
	expect(observedLocStart).toBe(locStart);
});

test('ignores plugins with an `undefined` parser map', async () => {
	const expectedOutput = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [pluginTypeScriptComments],
	});

	const output = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [
			/* prettier-ignore */
			{ parsers: undefined },
			pluginTypeScriptComments,
		],
	});

	expect(output).toBe(expectedOutput);
});

test.each([
	['after this plugin', 'babel'],
	['after this plugin', 'oxc'],
	['after this plugin', 'oxc-ts'],
	['after this plugin', 'typescript'],
	['alone', 'babel'],
	['alone', 'oxc'],
	['alone', 'oxc-ts'],
	['alone', 'typescript'],
	['before this plugin', 'babel'],
	['before this plugin', 'oxc'],
	['before this plugin', 'oxc-ts'],
	['before this plugin', 'typescript'],
] as const)(
	'runs lazy copied hooks once when placed %s with the `%s` parser',
	async (placement, parserName) => {
		const parser = getDirectParser(pluginTypeScriptComments, parserName);
		const parse = vi.fn(function (
			this: Parser,
			text: string,
			options: ParserOptions
		) {
			return parser.parse.call(this, text, options);
		});
		const preprocess = vi.fn(function (
			this: Parser,
			text: string,
			options: ParserOptions
		): Promise<string> | string {
			return parser.preprocess!.call(
				this,
				text.replace('(', '(baz, '),
				options
			);
		});

		const wrapperPlugin = {
			parsers: {
				[parserName]: async () => {
					await Promise.resolve();
					return { ...parser, parse, preprocess };
				},
			},
		} as unknown as Plugin;

		const expectedOutput = await format('foo(baz,   bar  )\n', {
			parser: parserName,
			plugins: [pluginOxc, pluginTypeScriptComments],
		});

		const plugins = {
			'after this plugin': [
				pluginOxc,
				pluginTypeScriptComments,
				wrapperPlugin,
			],
			'alone': [pluginOxc, wrapperPlugin],
			'before this plugin': [
				pluginOxc,
				wrapperPlugin,
				pluginTypeScriptComments,
			],
		}[placement];

		const output = await format(TEST_JAVASCRIPT, {
			parser: parserName,
			plugins,
		});

		expect(parse).toHaveBeenCalledTimes(1);
		expect(preprocess).toHaveBeenCalledTimes(1);
		expect(output).toBe(expectedOutput);
	}
);

test.each([
	['a copied `parse` hook', 'babel', 'parse', true],
	['a copied `parse` hook', 'oxc', 'parse', true],
	['a copied `parse` hook', 'oxc-ts', 'parse', true],
	['a copied `parse` hook', 'typescript', 'parse', true],
	[
		'a copied `preprocess` hook through a wrapper that calls this plugin’s parser',
		'babel',
		'preprocess',
		false,
	],
	[
		'a copied `preprocess` hook through a wrapper that calls this plugin’s parser',
		'oxc',
		'preprocess',
		false,
	],
	[
		'a copied `preprocess` hook through a wrapper that calls this plugin’s parser',
		'oxc-ts',
		'preprocess',
		false,
	],
	[
		'a copied `preprocess` hook through a wrapper that calls this plugin’s parser',
		'typescript',
		'preprocess',
		false,
	],
	[
		'a copied `preprocess` hook through a wrapper that forwards its receiver',
		'babel',
		'preprocess',
		true,
	],
	[
		'a copied `preprocess` hook through a wrapper that forwards its receiver',
		'oxc',
		'preprocess',
		true,
	],
	[
		'a copied `preprocess` hook through a wrapper that forwards its receiver',
		'oxc-ts',
		'preprocess',
		true,
	],
	[
		'a copied `preprocess` hook through a wrapper that forwards its receiver',
		'typescript',
		'preprocess',
		true,
	],
] as const)(
	'runs %s after plugin list replacement with the `%s` parser',
	async (_, parserName, hook, preserveReceiver) => {
		const parser = getDirectParser(pluginTypeScriptComments, parserName);
		const priorHook = vi.fn((text: string, options: ParserOptions) =>
			parser[hook]!(text.replace('(', '(baz, '), options)
		);

		const innerPlugin: Plugin = {
			parsers: {
				[parserName]: {
					...parser,
					[hook]: priorHook,
				},
			},
		};

		const outerPlugin: Plugin = {
			parsers: {
				[parserName]: {
					...parser,
					preprocess(text, options): Promise<string> | string {
						options.plugins = [innerPlugin];

						if (hook === 'parse') {
							return text;
						}

						return preserveReceiver
							? parser.preprocess!.call(this, text, options)
							: parser.preprocess!(text, options);
					},
				},
			},
		};

		const expectedOutput = await format('foo(baz,   bar  )\n', {
			parser: parserName,
			plugins: [pluginOxc, pluginTypeScriptComments],
		});

		const output = await format(TEST_JAVASCRIPT, {
			parser: parserName,
			plugins: [
				pluginOxc,
				innerPlugin,
				outerPlugin,
				pluginTypeScriptComments,
			],
		});

		expect(priorHook).toHaveBeenCalledTimes(1);
		expect(output).toBe(expectedOutput);
	}
);

test('preserves parser lifecycle state after plugin list reassignment', async () => {
	const { locEnd, locStart } = createLocationFunctions();

	let observedLocEnd: Parser['locEnd'] | undefined;
	let observedLocStart: Parser['locStart'] | undefined;
	let observedPreprocessed: boolean | undefined;

	const initializeParser = vi.fn(async () => {
		let preprocessed = false;
		await Promise.resolve();

		return {
			...babelParsers.babel,
			parse: (text: string, options: ParserOptions) => {
				observedLocEnd = options.locEnd;
				observedLocStart = options.locStart;
				observedPreprocessed = preprocessed;
				return babelParsers.babel.parse(text, options);
			},
			preprocess: (text: string, options: ParserOptions) => {
				preprocessed = true;
				options.locEnd = locEnd;
				options.locStart = locStart;
				options.plugins = [...options.plugins];
				return text;
			},
		};
	});

	const lazyPlugin = {
		parsers: {
			babel: initializeParser,
		},
	} as unknown as Plugin;

	await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [lazyPlugin, pluginTypeScriptComments],
	});

	expect(initializeParser).toHaveBeenCalledTimes(1);
	expect(observedLocEnd).toBe(locEnd);
	expect(observedLocStart).toBe(locStart);
	expect(observedPreprocessed).toBe(true);
});

test('preserves reassigned plugins with the current plugin omitted', async () => {
	let observedLocEnd: Parser['locEnd'] | undefined;
	let observedLocStart: Parser['locStart'] | undefined;
	let observedPlugins: ParserOptions['plugins'] | undefined;
	let observedPreprocessed: boolean | undefined;

	const replacementParse = vi.fn(() => {
		throw new Error();
	});

	const replacementPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				parse: replacementParse,
			},
		},
	};

	const replacementPlugins: ParserOptions['plugins'] = [
		replacementPlugin,
		pluginTypeScriptComments,
	];

	const { locEnd, locStart } = createLocationFunctions();

	const initializeParser = vi.fn(async () => {
		let preprocessed = false;
		await Promise.resolve();

		return {
			...babelParsers.babel,
			parse: (text: string, options: ParserOptions) => {
				observedLocEnd = options.locEnd;
				observedLocStart = options.locStart;
				observedPlugins = options.plugins;
				observedPreprocessed = preprocessed;
				return babelParsers.babel.parse(text, options);
			},
			preprocess: (text: string, options: ParserOptions) => {
				preprocessed = true;
				options.locEnd = locEnd;
				options.locStart = locStart;
				options.plugins = replacementPlugins;
				return text;
			},
		};
	});

	const lazyPlugin = {
		parsers: {
			babel: initializeParser,
		},
	} as unknown as Plugin;

	await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [lazyPlugin, pluginTypeScriptComments],
	});

	expect(initializeParser).toHaveBeenCalledTimes(1);
	expect(observedLocEnd).toBe(locEnd);
	expect(observedLocStart).toBe(locStart);
	expect(observedPreprocessed).toBe(true);
	expect(observedPlugins).toStrictEqual([replacementPlugin]);
	expect(replacementParse).not.toHaveBeenCalled();
	expect(observedPlugins).not.toBe(replacementPlugins);
});

test('preserves reassigned plugins without omitted plugins', async () => {
	let observedLocEnd: Parser['locEnd'] | undefined;
	let observedLocStart: Parser['locStart'] | undefined;
	let observedPlugins: ParserOptions['plugins'] | undefined;
	let observedPreprocessed: boolean | undefined;

	const replacementParse = vi.fn(() => {
		throw new Error();
	});

	const replacementPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				parse: replacementParse,
			},
		},
	};

	const replacementPlugins: ParserOptions['plugins'] = [replacementPlugin];

	const { locEnd, locStart } = createLocationFunctions();

	const initializeParser = vi.fn(async () => {
		let preprocessed = false;
		await Promise.resolve();

		return {
			...babelParsers.babel,
			parse: (text: string, options: ParserOptions) => {
				observedLocEnd = options.locEnd;
				observedLocStart = options.locStart;
				observedPlugins = options.plugins;
				observedPreprocessed = preprocessed;
				return babelParsers.babel.parse(text, options);
			},
			preprocess: (text: string, options: ParserOptions) => {
				preprocessed = true;
				options.locEnd = locEnd;
				options.locStart = locStart;
				options.plugins = replacementPlugins;
				return text;
			},
		};
	});

	const lazyPlugin = {
		parsers: {
			babel: initializeParser,
		},
	} as unknown as Plugin;

	await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [lazyPlugin, pluginTypeScriptComments],
	});

	expect(initializeParser).toHaveBeenCalledTimes(1);
	expect(observedLocEnd).toBe(locEnd);
	expect(observedLocStart).toBe(locStart);
	expect(observedPreprocessed).toBe(true);
	expect(observedPlugins).toStrictEqual([replacementPlugin]);
	expect(replacementParse).not.toHaveBeenCalled();
	expect(observedPlugins).toBe(replacementPlugins);
});

test('omits resolved lazy plugin copies from prior parser options', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');

	let observedPlugins: ParserOptions['plugins'] | undefined;

	const initializeParser = vi.fn(async () => {
		await Promise.resolve();
		return parser;
	});

	const lazyPlugin = {
		parsers: {
			babel: initializeParser,
		},
	} as unknown as Plugin;

	const observingPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				parse: (text, options) => {
					observedPlugins = options.plugins;
					return babelParsers.babel.parse(text, options);
				},
			},
		},
	};

	await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [observingPlugin, lazyPlugin, pluginTypeScriptComments],
	});

	expect(initializeParser).toHaveBeenCalledTimes(1);
	expect(observedPlugins).not.toContain(lazyPlugin);
});

test('doesn’t initialize shadowed lazy parsers', async () => {
	const initializeParser = vi.fn(async () => {
		await Promise.resolve();
		return babelParsers.babel;
	});

	const lazyPlugin = {
		parsers: {
			babel: initializeParser,
		},
	} as unknown as Plugin;

	const priorPlugin: Plugin = {
		parsers: {
			babel: { ...babelParsers.babel },
		},
	};

	await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [lazyPlugin, priorPlugin, pluginTypeScriptComments],
	});

	expect(initializeParser).not.toHaveBeenCalled();
});

test('passes the compatibility options argument to prior parsers', async () => {
	const parse = vi.fn(
		(
			text: string,
			options: ParserOptions,
			compatibilityOptions?: ParserOptions
		) => babelParsers.babel.parse(text, compatibilityOptions ?? options)
	);

	const legacyPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				parse,
			},
		},
	};

	await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [legacyPlugin, pluginTypeScriptComments],
	});

	const [, options, compatibilityOptions] = parse.mock.lastCall!;

	expect(compatibilityOptions).toBe(options);
});

test('matches its own output after wrappers that copy the current parser hooks', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	const wrapperPlugin = createBabelWrapperPlugin({ ...parser });

	const expectedOutput = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [pluginTypeScriptComments],
	});

	const output = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [wrapperPlugin, pluginTypeScriptComments],
	});

	expect(output).toBe(expectedOutput);
});

test('continues to prior parsers through copied wrappers', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');

	const priorPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				preprocess: () => 'foo(  baz  )\n',
			},
		},
	};

	const wrapperPlugin = createBabelWrapperPlugin({ ...parser });

	const expectedOutput = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [priorPlugin, pluginTypeScriptComments],
	});

	const output = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [priorPlugin, wrapperPlugin, pluginTypeScriptComments],
	});

	expect(output).toBe(expectedOutput);
});

test('avoids recursion through wrappers that inherit from the current parser', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	let parseCallCount = 0;

	const wrapperParser = {
		parse: (text: string, options: ParserOptions) => {
			parseCallCount += 1;

			if (parseCallCount > 1) {
				throw new Error();
			}

			return parser.parse(text, options);
		},
	} as unknown as Parser;

	Object.setPrototypeOf(wrapperParser, parser);

	const wrapperPlugin = createBabelWrapperPlugin(wrapperParser);

	const expectedOutput = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [wrapperPlugin],
	});

	const output = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [wrapperPlugin, pluginTypeScriptComments],
	});

	expect(output).toBe(expectedOutput);
	expect(parseCallCount).toBe(1);
});

test('matches the wrapper’s output when it reuses the current `parse` function', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	const wrapperPlugin = createBabelWrapperPlugin({
		...parser,
		preprocess: () => 'foo(  baz  )\n',
	});

	const expectedOutput = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [wrapperPlugin],
	});

	const output = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [wrapperPlugin, pluginTypeScriptComments],
	});

	expect(output).toBe(expectedOutput);
});

test('rejects incompatible wrappers before skipping shared hooks', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');

	const wrapperPlugin = createBabelWrapperPlugin({
		...parser,
		astFormat: 'incompatible-javascript',
		preprocess: undefined,
	});

	await expect(
		format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins: [wrapperPlugin, pluginTypeScriptComments],
		})
	).rejects.toThrowErrorMatchingInlineSnapshot(
		`[TypeError: [prettier-plugin-typescript-comments] Unsupported AST format for the \`babel\` parser. Expected \`estree\`, received \`incompatible-javascript\`]`
	);
});

test('avoids recursion through wrappers that copy `preprocess`', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	const wrapperPlugin = createBabelWrapperPlugin({
		...parser,
		parse: (text, options) => babelParsers.babel.parse(text, options),
	});

	const expectedOutput = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [wrapperPlugin],
	});

	const output = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [wrapperPlugin, pluginTypeScriptComments],
	});

	expect(output).toBe(expectedOutput);
});

test.each(['after this plugin', 'alone', 'before this plugin'] as const)(
	'uses location fields from a copied wrapper placed %s only when Prettier selects it',
	async (placement) => {
		const parser = getDirectParser(pluginTypeScriptComments, 'babel');

		const locEnd = vi.fn(babelParsers.babel.locEnd);
		const locStart = vi.fn(babelParsers.babel.locStart);
		const parse = vi.fn(parser.parse);
		const priorLocEnd = vi.fn(babelParsers.babel.locEnd);
		const priorLocStart = vi.fn(babelParsers.babel.locStart);

		const priorPlugin: Plugin = {
			parsers: {
				babel: {
					...babelParsers.babel,
					locEnd: priorLocEnd,
					locStart: priorLocStart,
				},
			},
		};

		const wrapperPlugin = createBabelWrapperPlugin({
			...parser,
			locEnd,
			locStart,
			parse,
		});

		const options = {
			cursorOffset: TEST_JAVASCRIPT.indexOf('bar'),
			parser: 'babel',
		};

		const expectedResult = await formatWithCursor(TEST_JAVASCRIPT, {
			...options,
			plugins: [pluginTypeScriptComments],
		});

		const plugins = {
			'after this plugin': [
				priorPlugin,
				pluginTypeScriptComments,
				wrapperPlugin,
			],
			'alone': [priorPlugin, wrapperPlugin],
			'before this plugin': [
				priorPlugin,
				wrapperPlugin,
				pluginTypeScriptComments,
			],
		}[placement];

		const isSelectedParser = placement !== 'before this plugin';

		const result = await formatWithCursor(TEST_JAVASCRIPT, {
			...options,
			plugins,
		});

		expect(result).toStrictEqual(expectedResult);
		expect(parse).toHaveBeenCalledTimes(1);
		expect(isSelectedParser ? locEnd : priorLocEnd).toHaveBeenCalled();
		expect(isSelectedParser ? locStart : priorLocStart).toHaveBeenCalled();
		expect(isSelectedParser ? priorLocEnd : locEnd).not.toHaveBeenCalled();
		expect(
			isSelectedParser ? priorLocStart : locStart
		).not.toHaveBeenCalled();
	}
);

test.each([
	['parser fields', 'after this plugin'],
	['parser fields', 'alone'],
	['the `preprocess` hook', 'after this plugin'],
	['the `preprocess` hook', 'alone'],
] as const)(
	'preserves wrapper location overrides from %s when placed %s',
	async (source, placement) => {
		const parser = getDirectParser(pluginTypeScriptComments, 'babel');
		const { locEnd, locStart } = createLocationFunctions();

		let observedLocEnd: Parser['locEnd'] | undefined;
		let observedLocStart: Parser['locStart'] | undefined;
		let parsedOptions: ParserOptions | undefined;

		const priorParse = vi.fn((text: string, options: ParserOptions) => {
			observedLocEnd = options.locEnd;
			observedLocStart = options.locStart;
			parsedOptions = options;

			return babelParsers.babel.parse(text, options);
		});

		const priorPlugin: Plugin = {
			parsers: {
				babel: {
					...babelParsers.babel,
					parse: priorParse,
				},
			},
		};

		const wrapperParser: Parser = { ...parser };

		if (source === 'parser fields') {
			wrapperParser.locEnd = locEnd;
			wrapperParser.locStart = locStart;
		} else {
			wrapperParser.preprocess = (text, options) => {
				options.locEnd = locEnd;
				options.locStart = locStart;

				return text;
			};
		}

		const wrapperPlugin = createBabelWrapperPlugin(wrapperParser);
		const plugins = {
			'after this plugin': [
				priorPlugin,
				pluginTypeScriptComments,
				wrapperPlugin,
			],
			'alone': [priorPlugin, wrapperPlugin],
		}[placement];

		const expectedOutput = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins: [pluginTypeScriptComments],
		});

		const output = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins,
		});

		expect(observedLocEnd).toBe(locEnd);
		expect(observedLocStart).toBe(locStart);
		expect(priorParse).toHaveBeenCalledTimes(1);
		expect(parsedOptions?.locEnd).toBe(locEnd);
		expect(parsedOptions?.locStart).toBe(locStart);
		expect(output).toBe(expectedOutput);
	}
);

test.each([
	['parse', 'after this plugin'],
	['parse', 'alone'],
	['parse', 'before this plugin'],
	['preprocess', 'after this plugin'],
	['preprocess', 'alone'],
	['preprocess', 'before this plugin'],
] as const)(
	'passes location overrides from `%s` wrappers to the prior parser when placed %s',
	async (hook, placement) => {
		const parser = getDirectParser(pluginTypeScriptComments, 'babel');
		const { locEnd, locStart } = createLocationFunctions();

		let observedLocEnd: Parser['locEnd'] | undefined;
		let observedLocStart: Parser['locStart'] | undefined;
		let observedOptions: ParserOptions | undefined;
		let wrapperCallCount = 0;

		const priorHook = vi.fn((text: string, options: ParserOptions) => {
			observedLocEnd = options.locEnd;
			observedLocStart = options.locStart;
			observedOptions = options;

			return hook === 'parse'
				? babelParsers.babel.parse(text, options)
				: text;
		});

		const priorPlugin: Plugin = {
			parsers: {
				babel: {
					...babelParsers.babel,
					[hook]: priorHook,
				},
			},
		};

		const wrapperPlugin = createBabelWrapperPlugin({
			...parser,
			[hook]: async (text: string, options: ParserOptions) => {
				wrapperCallCount += 1;

				if (wrapperCallCount > 1) {
					throw new Error();
				}

				await Promise.resolve();
				options.locEnd = locEnd;
				options.locStart = locStart;

				return parser[hook]!(text, options);
			},
		});

		const plugins = {
			'after this plugin': [
				priorPlugin,
				pluginTypeScriptComments,
				wrapperPlugin,
			],
			'alone': [priorPlugin, wrapperPlugin],
			'before this plugin': [
				priorPlugin,
				wrapperPlugin,
				pluginTypeScriptComments,
			],
		}[placement];

		const expectedOutput = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins: [pluginTypeScriptComments],
		});

		const output = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins,
		});

		expect(observedLocEnd).toBe(locEnd);
		expect(observedLocStart).toBe(locStart);
		expect(priorHook).toHaveBeenCalledTimes(1);
		expect(wrapperCallCount).toBe(1);
		expect(output).toBe(expectedOutput);
		expect(observedOptions?.locEnd).toBe(locEnd);
		expect(observedOptions?.locStart).toBe(locStart);
	}
);

test.each([
	['parse', 'after this plugin'],
	['parse', 'alone'],
	['parse', 'before this plugin'],
	['preprocess', 'after this plugin'],
	['preprocess', 'alone'],
	['preprocess', 'before this plugin'],
] as const)(
	'passes plugin list overrides from `%s` wrappers to the prior parser when placed %s',
	async (hook, placement) => {
		const parser = getDirectParser(pluginTypeScriptComments, 'babel');

		let observedOptions: ParserOptions | undefined;
		let observedPlugins: ParserOptions['plugins'] | undefined;
		let wrapperCallCount = 0;

		const priorHook = vi.fn((text: string, options: ParserOptions) => {
			observedOptions = options;
			observedPlugins = options.plugins;

			return hook === 'parse'
				? babelParsers.babel.parse(text, options)
				: text;
		});

		const priorPlugin: Plugin = {
			parsers: {
				babel: {
					...babelParsers.babel,
					[hook]: priorHook,
				},
			},
		};

		const reassignedPlugins: ParserOptions['plugins'] = [priorPlugin];

		const wrapperPlugin = createBabelWrapperPlugin({
			...parser,
			[hook]: async (text: string, options: ParserOptions) => {
				wrapperCallCount += 1;

				if (wrapperCallCount > 1) {
					throw new Error();
				}

				await Promise.resolve();
				options.plugins = reassignedPlugins;

				return parser[hook]!(text, options);
			},
		});

		const plugins = {
			'after this plugin': [
				priorPlugin,
				pluginTypeScriptComments,
				wrapperPlugin,
			],
			'alone': [priorPlugin, wrapperPlugin],
			'before this plugin': [
				priorPlugin,
				wrapperPlugin,
				pluginTypeScriptComments,
			],
		}[placement];

		const expectedOutput = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins: [pluginTypeScriptComments],
		});

		const output = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins,
		});

		expect(observedPlugins).toBe(reassignedPlugins);
		expect(priorHook).toHaveBeenCalledTimes(1);
		expect(wrapperCallCount).toBe(1);
		expect(output).toBe(expectedOutput);
		expect(observedOptions?.plugins).toBe(reassignedPlugins);
	}
);

test.each([
	['parse', 'alone'],
	['parse', 'before an independent plugin instance'],
	['parse', 'before this plugin'],
	['preprocess', 'alone'],
	['preprocess', 'before an independent plugin instance'],
	['preprocess', 'before this plugin'],
] as const)(
	'runs a delegating `%s` wrapper once when placed %s with a prior parser',
	async (hook, placement) => {
		vi.resetModules();

		const firstPlugin = await import('../index.ts');
		const parser = getDirectParser(firstPlugin, 'babel');

		if (placement === 'before an independent plugin instance') {
			vi.resetModules();
		}

		const secondPlugin = await import('../index.ts');

		let wrapperCallCount = 0;

		const parse = vi.fn((text: string, options: ParserOptions) =>
			babelParsers.babel.parse(text, options)
		);
		const preprocess = vi.fn((text: string) => text.replace('(', '(baz, '));
		const initializeParser = vi.fn(async () => {
			await Promise.resolve();
			return { ...babelParsers.babel, parse, preprocess };
		});

		const priorPlugin = {
			parsers: {
				babel: initializeParser,
			},
		} as unknown as Plugin;

		const wrapperPlugin = createBabelWrapperPlugin({
			...parser,
			[hook]: async (text: string, options: ParserOptions) => {
				wrapperCallCount += 1;

				if (wrapperCallCount > 1) {
					throw new Error();
				}

				await Promise.resolve();
				return parser[hook]!(text.replace('(', '(qux, '), options);
			},
		});

		const expectedOutput = await format(
			hook === 'parse'
				? 'foo(qux, baz,   bar  )\n'
				: 'foo(baz, qux,   bar  )\n',
			{ parser: 'babel', plugins: [secondPlugin] }
		);

		const plugins = {
			'alone': [priorPlugin, wrapperPlugin],
			'before an independent plugin instance': [
				priorPlugin,
				wrapperPlugin,
				secondPlugin,
			],
			'before this plugin': [priorPlugin, wrapperPlugin, secondPlugin],
		}[placement];

		const output = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins,
		});

		expect(initializeParser).toHaveBeenCalledTimes(1);
		expect(parse).toHaveBeenCalledTimes(1);
		expect(preprocess).toHaveBeenCalledTimes(1);
		expect(wrapperCallCount).toBe(1);
		expect(output).toBe(expectedOutput);
	}
);

test.each([
	['parse', 'before an independent plugin instance'],
	['parse', 'before this plugin'],
	['preprocess', 'before an independent plugin instance'],
	['preprocess', 'before this plugin'],
] as const)(
	'passes lifecycle changes from `%s` wrappers to the prior parser when placed %s',
	async (hook, placement) => {
		vi.resetModules();

		const firstPlugin = await import('../index.ts');
		const parser = getDirectParser(firstPlugin, 'babel');

		if (placement === 'before an independent plugin instance') {
			vi.resetModules();
		}

		const secondPlugin = await import('../index.ts');

		const { locEnd, locStart } = createLocationFunctions();

		const reassignedPlugins: ParserOptions['plugins'] = [];
		let observedLocEnd: Parser['locEnd'] | undefined;
		let observedLocStart: Parser['locStart'] | undefined;
		let observedPlugins: ParserOptions['plugins'] | undefined;
		let wrapperCallCount = 0;

		const priorHook = vi.fn((text: string, options: ParserOptions) => {
			observedLocEnd = options.locEnd;
			observedLocStart = options.locStart;
			observedPlugins = options.plugins;
			return hook === 'parse'
				? babelParsers.babel.parse(text, options)
				: text;
		});

		const priorPlugin: Plugin = {
			parsers: {
				babel: {
					...babelParsers.babel,
					[hook]: priorHook,
				},
			},
		};

		const wrapperPlugin = createBabelWrapperPlugin({
			...parser,
			[hook]: async (text: string, options: ParserOptions) => {
				wrapperCallCount += 1;

				if (wrapperCallCount > 1) {
					throw new Error();
				}

				await Promise.resolve();
				options.locEnd = locEnd;
				options.locStart = locStart;
				options.plugins = reassignedPlugins;
				return parser[hook]!(text.replace('(', '(baz, '), options);
			},
		});

		const expectedOutput = await format('foo(baz,   bar  )\n', {
			parser: 'babel',
			plugins: [secondPlugin],
		});

		const output = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins: [priorPlugin, wrapperPlugin, secondPlugin],
		});

		expect(observedLocEnd).toBe(locEnd);
		expect(observedLocStart).toBe(locStart);
		expect(observedPlugins).toBe(reassignedPlugins);
		expect(priorHook).toHaveBeenCalledTimes(1);
		expect(wrapperCallCount).toBe(1);
		expect(output).toBe(expectedOutput);
	}
);

test.each(['alone', 'before this plugin'] as const)(
	'runs wrapped hooks once when placed %s without a prior parser',
	async (placement) => {
		const parser = getDirectParser(pluginTypeScriptComments, 'babel');
		let parseCallCount = 0;
		let preprocessCallCount = 0;

		const wrapperPlugin = createBabelWrapperPlugin({
			...parser,
			parse: (text, options) => {
				parseCallCount += 1;

				if (parseCallCount > 1) {
					throw new Error();
				}

				return parser.parse(text.replace('(', '(qux, '), options);
			},
			preprocess: async (text, options) => {
				preprocessCallCount += 1;

				if (preprocessCallCount > 1) {
					throw new Error();
				}

				await Promise.resolve();
				return parser.preprocess!(text.replace('(', '(baz, '), options);
			},
		});

		const expectedOutput = await format('foo(qux, baz,   bar  )\n', {
			parser: 'babel',
			plugins: [pluginTypeScriptComments],
		});

		const plugins = {
			'alone': [wrapperPlugin],
			'before this plugin': [wrapperPlugin, pluginTypeScriptComments],
		}[placement];

		const output = await format(TEST_JAVASCRIPT, {
			parser: 'babel',
			plugins,
		});

		expect(parseCallCount).toBe(1);
		expect(preprocessCallCount).toBe(1);
		expect(output).toBe(expectedOutput);
	}
);

test('adds an empty line after a shebang only after delegated preprocessing', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	const input = '#!/usr/bin/env node\nfoo(  bar  )\n';
	let preprocessCallCount = 0;

	const wrapperPlugin = createBabelWrapperPlugin({
		...parser,
		preprocess: async (text, options) => {
			preprocessCallCount += 1;

			if (preprocessCallCount > 1) {
				throw new Error();
			}

			const output = await parser.preprocess!(text, options);

			expect(output).toBe(input);

			return output.replace('(', '(baz, ');
		},
	});

	const output = await format(input, {
		parser: 'babel',
		plugins: [wrapperPlugin, pluginTypeScriptComments],
	});

	expect(preprocessCallCount).toBe(1);
	expect(output).toBe('#!/usr/bin/env node\n\nfoo(baz, bar);\n');
});

test('restores parser locations when a wrapper rejects after delegated parsing', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	const { locEnd, locStart } = createLocationFunctions();

	const priorPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				locEnd,
				locStart,
			},
		},
	};

	const error = new Error();
	let observedLocEnd: Parser['locEnd'] | undefined;
	let observedLocStart: Parser['locStart'] | undefined;
	let parseCallCount = 0;

	const wrapperPlugin = createBabelWrapperPlugin({
		...parser,
		parse: async (text, options) => {
			parseCallCount += 1;

			if (parseCallCount > 1) {
				throw new Error();
			}

			await parser.parse(text, options);

			observedLocEnd = options.locEnd;
			observedLocStart = options.locStart;

			throw error;
		},
	});

	const options = {
		astFormat: parser.astFormat,
		locEnd: parser.locEnd,
		locStart: parser.locStart,
		parser: 'babel',
		plugins: [priorPlugin, wrapperPlugin, pluginTypeScriptComments],
	} as unknown as ParserOptions;

	const originalPlugins = options.plugins;

	await expect(parser.parse(TEST_JAVASCRIPT, options)).rejects.toBe(error);

	expect(observedLocEnd).toBe(locEnd);
	expect(observedLocStart).toBe(locStart);
	expect(parseCallCount).toBe(1);
	expect(options.astFormat).toBe(parser.astFormat);
	expect(options.locEnd).toBe(parser.locEnd);
	expect(options.locStart).toBe(parser.locStart);
	expect(options.plugins).toBe(originalPlugins);
});

test('preserves locations reset by a wrapper before parsing again', async () => {
	const parser = getDirectParser(pluginTypeScriptComments, 'babel');
	const { locEnd, locStart } = createLocationFunctions();

	let observedParsedLocEnd: Parser['locEnd'] | undefined;
	let observedParsedLocStart: Parser['locStart'] | undefined;
	let observedResetLocEnd: Parser['locEnd'] | undefined;
	let observedResetLocStart: Parser['locStart'] | undefined;
	let wrapperCallCount = 0;

	const priorParse = vi.fn((text: string, options: ParserOptions) => {
		observedResetLocEnd = options.locEnd;
		observedResetLocStart = options.locStart;
		return babelParsers.babel.parse(text, options);
	});

	const priorPlugin: Plugin = {
		parsers: {
			babel: {
				...babelParsers.babel,
				locEnd,
				locStart,
				parse: priorParse,
			},
		},
	};

	const wrapperPlugin = createBabelWrapperPlugin({
		...parser,
		parse: async (text, options) => {
			wrapperCallCount += 1;

			if (wrapperCallCount > 1) {
				throw new Error();
			}

			const originalLocEnd = options.locEnd;
			const originalLocStart = options.locStart;

			await parser.parse(text, options);

			observedParsedLocEnd = options.locEnd;
			observedParsedLocStart = options.locStart;

			options.locEnd = originalLocEnd;
			options.locStart = originalLocStart;
			return parser.parse(text, options);
		},
	});

	const expectedOutput = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [pluginTypeScriptComments],
	});

	const output = await format(TEST_JAVASCRIPT, {
		parser: 'babel',
		plugins: [priorPlugin, wrapperPlugin, pluginTypeScriptComments],
	});

	expect(observedParsedLocEnd).toBe(locEnd);
	expect(observedParsedLocStart).toBe(locStart);
	expect(observedResetLocEnd).toBe(parser.locEnd);
	expect(observedResetLocStart).toBe(parser.locStart);
	expect(priorParse).toHaveBeenCalledTimes(2);
	expect(wrapperCallCount).toBe(1);
	expect(output).toBe(expectedOutput);
});

test('restores parser options after rejection with a prior continuation', async () => {
	const {
		allowParsing,
		delegationKey,
		error,
		getWrapperCallCount,
		nativeParse,
		options,
		originalPlugins,
		outerContext,
		parser,
	} = createRejectionFixture();

	Reflect.set(options, delegationKey, outerContext);

	await expect(parser.parse(TEST_JAVASCRIPT, options)).rejects.toBe(error);

	expect(Reflect.get(options, delegationKey)).toBe(outerContext);

	allowParsing();
	await parser.parse(TEST_JAVASCRIPT, options);

	expect(getWrapperCallCount()).toBe(2);
	expect(nativeParse).toHaveBeenCalledTimes(2);
	expect(outerContext.delegation.resolveNext).not.toHaveBeenCalled();
	expect(outerContext.syncOptions).toHaveBeenCalledTimes(2);
	expect(Reflect.get(options, delegationKey)).toBe(outerContext);
	expect(options.plugins).toBe(originalPlugins);
});

test('restores parser options after rejection without a prior continuation', async () => {
	const {
		allowParsing,
		delegationKey,
		error,
		getWrapperCallCount,
		nativeParse,
		options,
		originalPlugins,
		outerContext,
		parser,
	} = createRejectionFixture();

	await expect(parser.parse(TEST_JAVASCRIPT, options)).rejects.toBe(error);

	expect(Reflect.ownKeys(options)).not.toContain(delegationKey);

	allowParsing();
	await parser.parse(TEST_JAVASCRIPT, options);

	expect(getWrapperCallCount()).toBe(2);
	expect(nativeParse).toHaveBeenCalledTimes(2);
	expect(outerContext.delegation.resolveNext).not.toHaveBeenCalled();
	expect(outerContext.syncOptions).not.toHaveBeenCalled();
	expect(Reflect.ownKeys(options)).not.toContain(delegationKey);
	expect(options.plugins).toBe(originalPlugins);
});

test('skips unchanged copied hooks from an independent instance', async () => {
	vi.resetModules();

	const firstPlugin = await import('../index.ts');

	vi.resetModules();

	const secondPlugin = await import('../index.ts');
	const parser = getDirectParser(secondPlugin, 'babel');

	const priorParser: Parser = {
		...babelParsers.babel,
		preprocess: (text) => text,
	};

	const wrapperPlugin = createBabelWrapperPlugin({
		...getDirectParser(firstPlugin, 'babel'),
	});

	const resolvePriorParser = createPriorParserResolver(
		'babel',
		babelParsers.babel.astFormat,
		parser
	);

	const options = {
		parser: 'babel',
		plugins: [
			{
				parsers: {
					babel: priorParser,
				},
			},
			wrapperPlugin,
			secondPlugin,
		],
	} as unknown as ParserOptions;

	const parseResult = await resolvePriorParser(options, 'parse');
	const preprocessResult = await resolvePriorParser(options, 'preprocess');

	expect(parseResult?.parser).toBe(priorParser);
	expect(preprocessResult?.parser).toBe(priorParser);
});
