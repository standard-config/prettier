# Project Documentation

This document records constraints, durable facts, maintenance decisions, and rationale that are not obvious from source and configuration. `AGENTS.md` remains authoritative for agent instructions.

## Architecture

### Shared Constants Without Module Load Work

The shell and TypeScript plugins import shared patterns from `@standard-config/utilities/constants`. The [**Shared constants**](../AGENTS.md#plugins) constraint prevents those imports from triggering unrelated initialization or introducing a dependency that one plugin can’t load.

`@standard-config/utilities/get-supported-language-patterns` awaits Prettier’s `getSupportInfo()` at module load and imports `prettier-plugin-sh`. That plugin is only a development dependency of utilities, and the TypeScript plugin doesn’t depend on it. The `GLOB_SET_*` constants built with this helper therefore belong in `packages/prettier/src/constants`, within their only consuming package, rather than in shared constants.

## Compatibility

### Node.js Engine Ranges

The root `package.json` sets a newer Node.js minimum for development than `packages/prettier/package.json` sets for consumers. The private `@standard-config/utilities` package is bundled into the published config at build time, so its bundled code shares the config’s runtime requirements. The [**Node.js compatibility**](../AGENTS.md#compatibility) rule prevents the development runtime from becoming an accidental consumer requirement.

## Comment Formatting

### Directive Conversion

The TypeScript plugin’s conversion rules are defined by [`formatGroup`](../packages/prettier-plugin-typescript/src/wrap-comments/index.ts) and [`moveTrailingComments`](../packages/prettier-plugin-typescript/src/move-trailing-comments/index.ts). They cover directives matched by [`BLOCK_DIRECTIVE_PATTERN`](../packages/prettier-plugin-typescript/src/constants/index.ts), trailing suppressions, and qualifying fall-through comments.

The maintainer’s conversion policy includes bare `eslint-disable` and `eslint-enable` (without `-line` or `-next-line`), their `oxlint-` forms, and ESLint configuration comments: `eslint` rule settings, `eslint-env`, `exported`, `global`, and `globals`. Converting `//` to `/* … */` can activate previously ignored settings or suppressions. A `// global …` line intended as prose can consequently become a declaration. This is an accepted consequence.

[ESLint 10 reports `/* eslint-env */` comments as errors](https://eslint.org/docs/latest/use/migrate-to-10.0.0#-eslint-env-comments-are-reported-as-errors). The maintainer accepts this consequence of converting `eslint-env` for consistency.

Converting only the first line of an `eslint-disable` whose rules continue on indented lines below could suppress every rule. [`isContinuedList`](../packages/prettier-plugin-typescript/src/move-trailing-comments/index.ts) identifies continued lists.

### Formatting Stability

The extra formatting passes in [`wrapComments`](../packages/prettier-plugin-typescript/src/wrap-comments/index.ts) are intentional. Formatting first makes every edit use the lines Prettier prints. Formatting the edited code again keeps a directive as `//` when converting it would move it off the code it covers, and leaves a moved comment in its original place when Prettier would print it after code again.

When joining a line to a paragraph or collapsing its spaces would create a directive, the shared reflow engine’s [`parseNodes`](../packages/utilities/src/format-comment-block/index.ts) keeps that line as written on its own rather than starting a new reflowed paragraph with it. A new paragraph could wrap differently and move where the next run splits paragraphs.

### Next-Line Directives

[`NEXT_LINE_DIRECTIVE_PATTERN`](../packages/utilities/src/constants/index.ts) identifies directives whose meaning depends on the line immediately below them, including Semgrep’s `nosemgrep`, detect-secrets’ `pragma: allowlist nextline secret`, and cspell’s `cspell:disable-next-line`.

ShellCheck directives are deliberately excluded from this pattern. `# shellcheck disable=…` continues to apply across intervening comment lines, so moving a comment between the directive and its command doesn’t change the suppression.

Like the TypeScript plugin, the shell plugin keeps comments below `# prettier-ignore` in place. This preserves comment placement even though `prettier-plugin-sh` currently formats commands beneath that marker.

### Shebang Spacing

By maintainer decision, the shell plugin doesn’t add an empty line after a shebang. The TypeScript plugin does.

### TypeScript Limitations

The following limitations are accepted:

- A doc comment line containing `|` outside code spans and inline tags counts as a Markdown table row. Prose containing a bare `|` therefore isn’t reflowed.
- Comments in indented embeds, such as code blocks in Markdown list items, are measured from column 0 of the embedded code. The surrounding indentation can make the final lines exceed the requested print width.
- With `insertPragma`, when Prettier merges the pragma into an existing docblock, comment reflow waits until the next run.
