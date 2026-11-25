import type { Comment } from 'oxc-parser';
import type { OxcLanguage, OxcNode } from '../types/index.d.ts';
import { visitorKeys } from 'oxc-parser';

type Context = {
	castCommentEnds: Set<number>;
	comments: Comment[];
	language: OxcLanguage;
	text: string;
	textWithoutComments?: string;
};

// Prettier reads `__contentEnd` to find the last token before the semicolon
const CONTENT_END_TYPES = new Set([
	'AccessorProperty',
	'DoWhileStatement',
	'ExportAllDeclaration',
	'ExportDefaultDeclaration',
	'ExportNamedDeclaration',
	'ExpressionStatement',
	'ImportDeclaration',
	'PropertyDefinition',
	'ReturnStatement',
	'TSAbstractAccessorProperty',
	'TSAbstractPropertyDefinition',
	'ThrowStatement',
]);

const TYPE_CAST_PATTERN = /@(?:type|satisfies)\b/;

/**
 * Adapts the Oxc tree to Prettier’s `babel` conventions for JavaScript and
 * `typescript` conventions for TypeScript. Attaches comments to the root.
 */
export default function normalizeOxcAST(
	program: OxcNode,
	comments: Comment[],
	text: string,
	language: OxcLanguage
): OxcNode {
	const { hashbang } = program;
	delete program.hashbang;

	// For TypeScript, the parser leaves the hashbang out of the comments
	if (isNode(hashbang) && comments[0]?.start !== hashbang.start) {
		comments.unshift(hashbang as unknown as Comment);
	}

	mergeAdjacentDocComments(comments);

	const context: Context = {
		castCommentEnds: new Set(
			language === 'js'
				? comments.filter(isTypeCastComment).map(({ end }) => end)
				: []
		),
		comments,
		language,
		text,
	};
	const root = visit(program, context);
	root.comments = comments;

	return root;
}

/**
 * Merges multi-line doc comments whose delimiters touch.
 */
function mergeAdjacentDocComments(comments: Comment[]): void {
	for (let index = comments.length - 2; index >= 0; index--) {
		const comment = comments[index]!;
		const nextComment = comments[index + 1]!;

		if (
			comment.end === nextComment.start &&
			isMultilineDocComment(comment) &&
			isMultilineDocComment(nextComment)
		) {
			comment.value += `*//*${nextComment.value}`;
			comment.end = nextComment.end;
			comments.splice(index + 1, 1);
		}
	}
}

/**
 * Normalizes a node and its descendants for Prettier’s printer.
 */
function visit(node: OxcNode, context: Context): OxcNode {
	const replacement = enter(node, context);

	if (replacement !== node) {
		return visit(replacement, context);
	}

	for (const key of visitorKeys[node.type] ?? []) {
		const child = node[key];

		if (Array.isArray(child)) {
			for (const [index, item] of child.entries()) {
				if (isNode(item)) {
					child[index] = visit(item, context);
				}
			}
		} else if (isNode(child)) {
			node[key] = visit(child, context);
		}
	}

	return isUnbalancedLogicalExpression(node)
		? rebalanceLogicalExpression(node)
		: node;
}

/**
 * Adapts or replaces a node before traversal reaches its children.
 */
function enter(node: OxcNode, context: Context): OxcNode {
	if (CONTENT_END_TYPES.has(node.type)) {
		setContentEnd(node, context);
	}

	switch (node.type) {
		case 'ParenthesizedExpression': {
			if (follows(node, context.castCommentEnds, context.text)) {
				return node;
			}

			const expression = node.expression as OxcNode;
			expression.extra = {
				...(expression.extra as Record<string, unknown> | undefined),
				parenthesized: true,
			};
			return expression;
		}

		case 'TemplateElement':
			// Oxc includes the delimiters in TypeScript template elements.
			// Prettier expects the range to cover just the template text
			if (context.language === 'ts') {
				node.start += 1;
				node.end -= node.tail ? 1 : 2;
			}

			return node;

		// A leading `&` or `|` gives a single type its own intersection or
		// union, which the built-in parser replaces with that type
		case 'TSIntersectionType':

		case 'TSUnionType': {
			const types = node.types as OxcNode[];

			return types.length === 1 ? types[0]! : node;
		}

		case 'TSParenthesizedType':
			return node.typeAnnotation as OxcNode;

		default:
			if (context.castCommentEnds.size > 0) {
				wrapCastTargets(node, context);
			}

			return node;
	}
}

/**
 * Records the end of the last token before a node’s trailing semicolon.
 */
function setContentEnd(node: OxcNode, context: Context): void {
	if (context.text[node.end - 1] !== ';') {
		return;
	}

	node.__contentEnd =
		node.start +
		getTextWithoutComments(context)
			.slice(node.start, node.end - 1)
			.trimEnd().length;
}

/**
 * Restores parentheses around assignment targets marked with a JSDoc cast.
 */
function wrapCastTargets(node: OxcNode, context: Context): void {
	switch (node.type) {
		case 'ArrayPattern': {
			const elements = node.elements as unknown[];

			for (const [index, element] of elements.entries()) {
				if (isNode(element)) {
					elements[index] = wrapCastTarget(element, context);
				}
			}

			break;
		}

		case 'AssignmentExpression':

		case 'AssignmentPattern':
			node.left = wrapCastTarget(node.left as OxcNode, context);

			break;

		case 'ForInStatement':

		case 'ForOfStatement': {
			const left = node.left as OxcNode;

			if (left.type !== 'VariableDeclaration') {
				node.left = wrapCastTarget(left, context);
			}

			break;
		}

		case 'Property':
			if (!node.shorthand) {
				node.value = wrapCastTarget(node.value as OxcNode, context);
			}

			break;

		case 'RestElement':

		case 'UpdateExpression':
			node.argument = wrapCastTarget(node.argument as OxcNode, context);

			break;

		// No default
	}
}

/**
 * Wraps a target in each pair of parentheses that follows a JSDoc cast.
 */
function wrapCastTarget(node: OxcNode, context: Context): OxcNode {
	if (node.type === 'ParenthesizedExpression') {
		return node;
	}

	// Comments can sit inside each pair of parentheses, but only whitespace can
	// separate an opening parenthesis from the type cast comment. Like the
	// built-in parser, keep each pair that follows a cast and drop the others
	const textWithoutComments = getTextWithoutComments(context);
	let result = node;
	let { end, start } = node;

	for (;;) {
		const opening = skipWhitespaceBackward(textWithoutComments, start) - 1;
		const closing = skipWhitespaceForward(textWithoutComments, end);

		if (
			textWithoutComments[opening] !== '(' ||
			textWithoutComments[closing] !== ')'
		) {
			return result;
		}

		start = opening;
		end = closing + 1;

		if (follows({ start }, context.castCommentEnds, context.text)) {
			result = {
				end,
				expression: result,
				start,
				type: 'ParenthesizedExpression',
			};
		}
	}
}

/**
 * Groups a chain of identical logical operators from the left.
 */
function rebalanceLogicalExpression(node: OxcNode): OxcNode {
	const right = node.right as OxcNode;
	const left = {
		end: (right.left as OxcNode).end,
		left: node.left,
		operator: node.operator,
		right: right.left,
		start: (node.left as OxcNode).start,
		type: 'LogicalExpression',
	};
	// The right side is balanced, so only the new left side can need a rotation
	return {
		end: node.end,
		left: isUnbalancedLogicalExpression(left)
			? rebalanceLogicalExpression(left)
			: left,
		operator: node.operator,
		right: right.right,
		start: node.start,
		type: 'LogicalExpression',
	};
}

/**
 * Checks whether the right operand repeats the same logical operator.
 */
function isUnbalancedLogicalExpression(node: OxcNode): boolean {
	const { right } = node;

	return (
		node.type === 'LogicalExpression' &&
		isNode(right) &&
		right.type === 'LogicalExpression' &&
		right.operator === node.operator
	);
}

/**
 * Checks whether only whitespace separates a marked comment from a node.
 */
function follows(
	node: Pick<OxcNode, 'start'>,
	commentEnds: Set<number>,
	text: string
): boolean {
	return commentEnds.has(skipWhitespaceBackward(text, node.start));
}

/**
 * Returns the source with comments masked for offset lookups.
 */
function getTextWithoutComments(context: Context): string {
	context.textWithoutComments ??= blankComments(
		context.text,
		context.comments
	);

	return context.textWithoutComments;
}

/**
 * Masks comments with spaces while preserving offsets, CR, and LF.
 */
function blankComments(text: string, comments: Comment[]): string {
	let result = '';
	let offset = 0;

	for (const { end, start } of comments) {
		result +=
			text.slice(offset, start) +
			text.slice(start, end).replaceAll(/[^\n\r]/g, ' ');
		offset = end;
	}

	return result + text.slice(offset);
}

/**
 * Checks for a multi-line block comment with a leading `*` on each line.
 */
function isMultilineDocComment({ type, value }: Comment): boolean {
	return (
		type === 'Block' &&
		value.includes('\n') &&
		`*${value}*`
			.split('\n')
			.every((line) => line.trimStart().startsWith('*'))
	);
}

/**
 * Checks whether a value is an object with a string `type` property.
 */
function isNode(value: unknown): value is OxcNode {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as OxcNode).type === 'string'
	);
}

/**
 * Checks for a JSDoc cast marked with `@type` or `@satisfies`.
 */
function isTypeCastComment({ type, value }: Comment): boolean {
	return (
		type === 'Block' &&
		value.startsWith('*') &&
		TYPE_CAST_PATTERN.test(value)
	);
}

/**
 * Returns the offset before any whitespace immediately to the left.
 */
function skipWhitespaceBackward(text: string, offset: number): number {
	let index = offset;

	while (index > 0 && /\s/.test(text[index - 1]!)) {
		index--;
	}

	return index;
}

/**
 * Returns the offset after any whitespace immediately to the right.
 */
function skipWhitespaceForward(text: string, offset: number): number {
	let index = offset;

	while (index < text.length && /\s/.test(text[index]!)) {
		index++;
	}

	return index;
}
