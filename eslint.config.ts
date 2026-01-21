import { includeIgnoreFile } from '@eslint/compat';
import pluginPerfectionist from 'eslint-plugin-perfectionist';
import { defineConfig, globalIgnores } from 'eslint/config';
import { resolve as resolvePath } from 'node:path';
import tseslint from 'typescript-eslint';

export default defineConfig([
	includeIgnoreFile(resolvePath('.gitignore')),
	globalIgnores(['fixtures/**']),
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: 'error',
			reportUnusedInlineConfigs: 'error',
		},
		rules: {
			'camelcase': ['error', { properties: 'always' }],
			'dot-notation': 'error',
			'func-name-matching': [
				'error',
				'never',
				{ considerPropertyDescriptor: true },
			],
		},
	},
	{
		plugins: {
			'@typescript-eslint': tseslint.plugin,
		},
		rules: {
			'@typescript-eslint/consistent-type-assertions': [
				'error',
				{
					assertionStyle: 'as',
					objectLiteralTypeAssertions: 'allow-as-parameter',
				},
			],
			'@typescript-eslint/consistent-type-exports': [
				'error',
				{ fixMixedExportsWithInlineTypeSpecifier: true },
			],
			'@typescript-eslint/no-unnecessary-qualifier': 'error',
			'@typescript-eslint/no-useless-default-assignment': 'error',
			'@typescript-eslint/parameter-properties': [
				'error',
				{ prefer: 'parameter-property' },
			],
			'@typescript-eslint/prefer-readonly': 'error',
		},
	},
	{
		plugins: {
			perfectionist: pluginPerfectionist,
		},
		rules: {
			'perfectionist/sort-array-includes': ['error', { type: 'natural' }],
			'perfectionist/sort-classes': [
				'error',
				{
					groups: ['property', 'constructor'],
					type: 'natural',
				},
			],
			'perfectionist/sort-exports': ['error', { type: 'natural' }],
			'perfectionist/sort-imports': [
				'error',
				{
					groups: [
						['type-builtin', 'type-external'],
						'type-internal',
						['type-parent', 'type-sibling', 'type-index'],
						['value-builtin', 'value-external'],
						'value-internal',
						['value-parent', 'value-sibling', 'value-index'],
						'unknown',
						'style',
						'side-effect',
						'side-effect-style',
					],
					newlinesBetween: 0,
					sortSideEffects: true,
					type: 'natural',
				},
			],
			'perfectionist/sort-interfaces': [
				'error',
				{
					groups: ['index-signature', 'unknown', 'method'],
					type: 'natural',
				},
			],
			'perfectionist/sort-intersection-types': [
				'error',
				{ type: 'natural' },
			],
			'perfectionist/sort-named-exports': ['error', { type: 'natural' }],
			'perfectionist/sort-named-imports': ['error', { type: 'natural' }],
			'perfectionist/sort-object-types': [
				'error',
				{
					groups: ['index-signature', 'unknown', 'method'],
					type: 'natural',
				},
			],
			'perfectionist/sort-objects': [
				'error',
				{
					type: 'natural',
					useConfigurationIf: {
						objectType: 'destructured',
					},
				},
				{
					type: 'unsorted',
					useConfigurationIf: {
						objectType: 'non-destructured',
					},
				},
			],
			'perfectionist/sort-union-types': [
				'error',
				{
					customGroups: [
						{
							elementNamePattern: '^false$',
							groupName: 'false',
						},
						{
							elementNamePattern: '^never$',
							groupName: 'never',
						},
					],
					groups: ['unknown', 'tuple', 'false', 'nullish', 'never'],
					type: 'natural',
				},
			],
		},
	},
	{
		files: ['*.config.ts'],
		rules: {
			'perfectionist/sort-objects': [
				'error',
				{
					customGroups: [
						{
							elementNamePattern: '^extends$',
							groupName: 'extends',
						},
						{
							elementNamePattern: '^files$',
							groupName: 'files',
						},
						{
							elementNamePattern: '^overrides$',
							groupName: 'overrides',
						},
						{
							elementNamePattern: '^plugins$',
							groupName: 'plugins',
						},
						{
							elementNamePattern: '^rules$',
							groupName: 'rules',
						},
					],
					groups: [
						'files',
						'extends',
						'plugins',
						'unknown',
						'rules',
						'overrides',
					],
					newlinesBetween: 0,
					type: 'natural',
				},
			],
		},
	},
]);
