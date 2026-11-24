import { expect, test } from 'vite-plus/test';
import {
	BASH_VARIANT,
	BATS_VARIANT,
	MKSH_VARIANT,
} from '../constants/index.ts';
import inferVariant from './index.ts';

test('infers Bats from a `.bats` extension', () => {
	expect(inferVariant('foo\n', 'foo.bats')).toBe(BATS_VARIANT);
	expect(inferVariant('foo\n', '.bats')).toBe(BATS_VARIANT);
});

test('infers mksh from an `.mksh` extension', () => {
	expect(inferVariant('foo\n', 'foo.mksh')).toBe(MKSH_VARIANT);
});

test('infers Bats from a Bats shebang', () => {
	expect(inferVariant('#!/usr/bin/env bats\n', 'foo.md')).toBe(BATS_VARIANT);
});

test('infers mksh from an mksh shebang', () => {
	expect(inferVariant('#!/bin/mksh\n', 'foo.sh')).toBe(MKSH_VARIANT);
});

test('prefers an extension over a shebang', () => {
	expect(inferVariant('#!/bin/mksh\n', 'foo.bats')).toBe(BATS_VARIANT);
	expect(inferVariant('#!/bin/mksh\n', 'foo.bash')).toBe(BASH_VARIANT);
	expect(inferVariant('#!/bin/mksh\n', 'foo.zsh')).toBe(BASH_VARIANT);
});

test('falls back to Bash', () => {
	expect(inferVariant('#!/bin/sh\n', 'foo.sh')).toBe(BASH_VARIANT);
	expect(inferVariant('foo\n', undefined)).toBe(BASH_VARIANT);
});

test('ignores interpreters whose names only start with a variant name', () => {
	expect(inferVariant('#!/usr/bin/env batsman\n', 'foo.sh')).toBe(
		BASH_VARIANT
	);
});
