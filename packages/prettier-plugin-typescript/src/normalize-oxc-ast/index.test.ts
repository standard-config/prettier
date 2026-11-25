import type { OxcLanguage, OxcNode } from '../types/index.d.ts';
import { expect, test } from 'vite-plus/test';
import parseOxc from '../parse-oxc/index.ts';
import normalizeOxcAST from './index.ts';

type Statement = OxcNode & { expression: OxcNode };

function normalize(text: string, language: OxcLanguage = 'js'): OxcNode {
	const { comments, program } = parseOxc(text, undefined, language);

	return normalizeOxcAST(program, comments, text, language);
}

function getStatements(program: OxcNode): Statement[] {
	return program.body as Statement[];
}

test('attaches the comments to the root', () => {
	expect(normalize('// foo\nbar(); /* baz */\n').comments).toStrictEqual([
		{ end: 6, start: 0, type: 'Line', value: ' foo' },
		{ end: 23, start: 14, type: 'Block', value: ' baz ' },
	]);
});

test.each(['js', 'ts'] as const)(
	'lists the hashbang once among the comments of %s code',
	(language) => {
		const program = normalize('#!/usr/bin/env node\nfoo();\n', language);

		expect(program).not.toHaveProperty('hashbang');
		expect(program.comments).toMatchObject([
			{ end: 19, start: 0, value: '/usr/bin/env node' },
		]);
	}
);

test('merges adjacent multi-line doc comments', () => {
	const program = normalize(
		'/**\n * foo\n *//**\n * bar\n *//**\n * baz\n */\nqux();\n'
	);

	expect(program.comments).toStrictEqual([
		{
			end: 42,
			start: 0,
			type: 'Block',
			value: '*\n * foo\n *//**\n * bar\n *//**\n * baz\n ',
		},
	]);
});

test('keeps other adjacent comments apart', () => {
	expect(normalize('/** foo *//** bar */\nbaz();\n').comments).toHaveLength(
		2
	);
	expect(
		normalize('/*\n foo\n *//**\n * bar\n */\nbaz();\n').comments
	).toHaveLength(2);
	expect(
		normalize('/**\n * foo\n */ /**\n * bar\n */\nbaz();\n').comments
	).toHaveLength(2);
	expect(
		normalize('// foo\n/**\n * bar\n */\nbaz();\n').comments
	).toHaveLength(2);
});

test('replaces parenthesized expressions with the expression they hold', () => {
	const [statement] = getStatements(normalize('(foo);\n'));

	expect(statement!.expression).toStrictEqual({
		end: 4,
		extra: { parenthesized: true },
		name: 'foo',
		start: 1,
		type: 'Identifier',
	});
});

test('keeps parenthesized expressions after type cast comments in JavaScript', () => {
	const input = 'foo = /** @type {Bar} */ (baz);\n';

	const [javascriptStatement] = getStatements(normalize(input, 'js'));
	const [typescriptStatement] = getStatements(normalize(input, 'ts'));

	expect(javascriptStatement!.expression.right).toMatchObject({
		expression: { name: 'baz' },
		type: 'ParenthesizedExpression',
	});
	expect(typescriptStatement!.expression.right).toMatchObject({
		extra: { parenthesized: true },
		name: 'baz',
	});
});

test('replaces parenthesized types with the type they hold', () => {
	const [declaration] = getStatements(normalize('type Foo = (Bar);\n', 'ts'));

	expect(declaration!.typeAnnotation).toMatchObject({
		start: 12,
		type: 'TSTypeReference',
	});
});

test('replaces intersections and unions of a single type with that type', () => {
	const [intersection, union, nested, pair] = getStatements(
		normalize(
			'type Foo = & Bar;\ntype Baz = | Qux;\ntype Quux = | (& Corge);\ntype Grault = | Garply | Waldo;\n',
			'ts'
		)
	);

	expect(intersection!.typeAnnotation).toMatchObject({
		type: 'TSTypeReference',
	});
	expect(union!.typeAnnotation).toMatchObject({ type: 'TSTypeReference' });
	expect(nested!.typeAnnotation).toMatchObject({ type: 'TSTypeReference' });
	expect(pair!.typeAnnotation).toMatchObject({ type: 'TSUnionType' });
});

test('restores parentheses around assignment targets after type cast comments', () => {
	const program = normalize(
		[
			'/** @type {A} */ (foo.bar) = 1;',
			'/** @type {A} */ (foo.bar)++;',
			'[/** @type {A} */ (foo.bar), , ...(/** @type {A} */ (foo.baz))] = qux;',
			'({ foo: /** @type {A} */ (foo.bar), baz } = qux);',
			'[/** @type {A} */ (foo.bar) = 1] = qux;',
			'for (/** @type {A} */ (foo.bar) of qux) {}',
			'for (const foo of qux) {}',
			'(foo.bar) = 1;',
			'/** @type {A} */ foo.bar = 1;',
			'',
		].join('\n')
	);
	const [
		assignment,
		update,
		arrayPattern,
		objectPattern,
		defaultValue,
		forOf,
		forOfDeclaration,
		withoutCast,
		withoutParentheses,
	] = getStatements(program);
	const wrapped = { type: 'ParenthesizedExpression' };

	expect(assignment!.expression.left).toMatchObject({
		end: 26,
		expression: { type: 'MemberExpression' },
		start: 17,
		type: 'ParenthesizedExpression',
	});
	expect(update!.expression.argument).toMatchObject(wrapped);
	expect((arrayPattern!.expression.left as OxcNode).elements).toMatchObject([
		wrapped,
		null,
		{ argument: wrapped, type: 'RestElement' },
	]);
	expect(
		(objectPattern!.expression.left as OxcNode).properties
	).toMatchObject([
		{ value: wrapped },
		{ shorthand: true, value: { type: 'Identifier' } },
	]);
	expect((defaultValue!.expression.left as OxcNode).elements).toMatchObject([
		{ left: wrapped, type: 'AssignmentPattern' },
	]);
	expect(forOf!.left).toMatchObject(wrapped);
	expect(forOfDeclaration!.left).toMatchObject({
		type: 'VariableDeclaration',
	});
	expect(withoutCast!.expression.left).toMatchObject({
		type: 'MemberExpression',
	});
	expect(withoutParentheses!.expression.left).toMatchObject({
		type: 'MemberExpression',
	});
});

test('restores parentheses around assignment targets with comments inside them', () => {
	const [leading, trailing, lineComment, beforeParenthesis] = getStatements(
		normalize(
			[
				'/** @type {A} */ (/* foo */ bar.baz) = 1;',
				'/** @type {A} */ (bar.baz /* foo */) = 1;',
				'/** @type {A} */ (// foo',
				'bar.baz) = 1;',
				'/** @type {A} */ /* foo */ (bar.baz) = 1;',
				'',
			].join('\n')
		)
	);

	expect(leading!.expression.left).toMatchObject({
		end: 36,
		start: 17,
		type: 'ParenthesizedExpression',
	});
	expect(trailing!.expression.left).toMatchObject({
		type: 'ParenthesizedExpression',
	});
	expect(lineComment!.expression.left).toMatchObject({
		type: 'ParenthesizedExpression',
	});
	expect(beforeParenthesis!.expression.left).toMatchObject({
		type: 'MemberExpression',
	});
});

test('keeps each pair of parentheses around assignment targets that follows a type cast comment', () => {
	const [nested, castInside, doubleCast] = getStatements(
		normalize(
			[
				'/** @type {A} */ ( /* foo */ ((bar.baz)) ) = 1;',
				'[(/** @type {A} */ (bar.baz))] = qux;',
				'/** @type {A} */ (/** @type {B} */ (bar.baz)) = 1;',
				'',
			].join('\n')
		)
	);

	expect(nested!.expression.left).toMatchObject({
		end: 42,
		expression: { type: 'MemberExpression' },
		start: 17,
		type: 'ParenthesizedExpression',
	});
	expect(
		((castInside!.expression.left as OxcNode).elements as OxcNode[])[0]
	).toMatchObject({
		expression: { type: 'MemberExpression' },
		start: 67,
		type: 'ParenthesizedExpression',
	});
	expect(doubleCast!.expression.left).toMatchObject({
		expression: {
			expression: { type: 'MemberExpression' },
			type: 'ParenthesizedExpression',
		},
		type: 'ParenthesizedExpression',
	});
});

test('covers only the text of template elements in TypeScript', () => {
	const input =
		/* oxlint-disable-next-line no-template-curly-in-string */
		'foo`bar${baz}qux`;\ntype Quux = `corge${Grault}`;\n';

	const [javascriptStatement] = getStatements(
		normalize(input.split('\n')[0]!)
	);
	const [typescriptStatement, typeAlias] = getStatements(
		normalize(input, 'ts')
	);

	expect(
		(javascriptStatement!.expression.quasi as OxcNode).quasis
	).toMatchObject([
		{ end: 7, start: 4 },
		{ end: 16, start: 13 },
	]);
	expect(
		(typescriptStatement!.expression.quasi as OxcNode).quasis
	).toMatchObject([
		{ end: 7, start: 4 },
		{ end: 16, start: 13 },
	]);
	expect((typeAlias!.typeAnnotation as OxcNode).quasis).toMatchObject([
		{ end: 37, start: 32 },
		{ end: 46, start: 46 },
	]);
});

test('rotates chains of the same logical operator to nest on the left', () => {
	const [chain, mixed] = getStatements(
		normalize('foo || (bar || (baz || qux));\nfoo || (bar && baz);\n')
	);

	expect(chain!.expression).toMatchObject({
		end: 28,
		left: {
			end: 19,
			left: {
				end: 11,
				left: { name: 'foo' },
				right: { name: 'bar' },
				start: 0,
			},
			right: { name: 'baz' },
			start: 0,
		},
		operator: '||',
		right: { name: 'qux' },
		start: 0,
	});
	expect(mixed!.expression).toMatchObject({
		left: { name: 'foo' },
		operator: '||',
		right: { operator: '&&' },
	});
});

test('records where content ends before a semicolon', () => {
	const [withComments, withoutSemicolon, classDeclaration] = getStatements(
		normalize('foo() /* bar */\n ;\nbaz()\nclass Qux { quux = 1 ; }\n')
	);
	const classBody = classDeclaration!.body as OxcNode;

	expect(withComments!.__contentEnd).toBe(5);
	expect(withoutSemicolon).not.toHaveProperty('__contentEnd');
	expect((classBody.body as OxcNode[])[0]!.__contentEnd).toBe(45);
});

test('leaves nodes of types the parser doesn’t declare as they are', () => {
	const child = { end: 1, start: 0, type: 'ParenthesizedExpression' };
	const node = { child, end: 1, start: 0, type: 'Foo' };
	const program = { body: [node], end: 1, start: 0, type: 'Program' };

	const result = normalizeOxcAST(program, [], 'a', 'js');

	expect(result.body).toStrictEqual([node]);
	expect(node.child).toBe(child);
});
