# Project Documentation

This document records constraints, durable facts, maintenance decisions, and rationale that are not obvious from source and configuration. `AGENTS.md` remains authoritative for agent instructions.

## Architecture

### Override Plugin Lists

The JSON and `package.json` overrides deliberately omit the shell and TypeScript plugins. Prettier checks every option in effect for a file against its active plugins. That includes options from earlier matching overrides, such as the Markdown override’s `shUseTabs` setting.

When an override supplies a `plugins` list, even an empty one, the config prepends a plugin that declares the shell options (`sh*`) and `tsCommentWrap`. This prevents unknown option warnings when the list replaces the global plugins. Prettier uses the last declaration of each option, so the override’s own plugins take precedence. See [`transformConfig`](../packages/prettier/src/transform-config/index.ts).

### Shared Constants Without Module Load Work

The shell and TypeScript plugins import shared patterns from `@standard-config/utilities/constants`. The [**Shared constants**](../AGENTS.md#plugins) constraint prevents those imports from triggering unrelated initialization or introducing a dependency that one plugin can’t load.

`@standard-config/utilities/get-supported-language-patterns` awaits Prettier’s `getSupportInfo()` at module load. The config defines the `GLOB_SET_*` constants that use this helper in `packages/prettier/src/constants`, so importing shared patterns doesn’t trigger that lookup.

The config builds `GLOB_SET_SHELL` from the languages exported by `prettier-plugin-shell`. Moving that lookup into utilities would create a workspace dependency cycle because the shell plugin already depends on utilities.

### Shell Indentation

Shell scripts can’t be reliably identified by file name alone because Prettier also recognizes them by their shebang. `prettier-plugin-shell` therefore applies `shTabWidth` and `shUseTabs` in its printer, allowing the config’s global indentation defaults to serve other languages without relying on file name overrides to identify shell scripts.

### Shell Language Selection

The shell plugin maintains its own [`Shell` language entry](../packages/prettier-plugin-shell/src/index.ts) independently of GitHub Linguist. Its file names, extensions, and interpreters must reliably identify shell scripts. Formatting data files as Bash can silently change their contents. For example, Bash treats an unquoted `&` in a dotenv URL as a shell operator, so the formatter splits the value across lines.

The plugin omits Nushell and Tcsh because their syntax is incompatible with the Bash parser in `sh-syntax`. Because ksh and Zsh scripts mostly use syntax that Bash also accepts, the plugin keeps their names and [defaults to parsing them as Bash](../packages/prettier-plugin-shell/src/infer-variant/index.ts), though a `#!/bin/mksh` shebang selects mksh for a `.ksh` file. Shell-specific syntax can stop formatting before the script is rewritten. For example, the Bash parser reports a syntax error for Zsh’s `${(j: :)parts}` expansion.

The plugin omits ambiguous extensions such as `.cgi`, which can also identify Perl or Python scripts. It omits generated wrappers such as `gradlew` by name because regeneration overwrites formatting changes. The Husky rule matches only files directly inside `.husky` whose names contain no dot. Matching the whole directory would let shell formatting change patterns in `.husky/.gitignore`. Tool names such as `husky` serve as aliases so existing Markdown code fences still format as shell scripts.

## Compatibility

### Node.js Engine Ranges

The root `package.json` sets a newer Node.js minimum for development than `packages/prettier/package.json` sets for consumers. The consumer minimum also applies to code the published config bundles from `@standard-config/utilities`, `prettier-plugin-shell`, and `prettier-plugin-typescript`. The [**Node.js compatibility**](../AGENTS.md#compatibility) rule prevents the development runtime from becoming an accidental consumer requirement.

## Comment Formatting

### Directive Conversion

The TypeScript plugin’s conversion rules are defined by [`formatGroup`](../packages/prettier-plugin-typescript/src/wrap-comments/index.ts) and [`moveTrailingComments`](../packages/prettier-plugin-typescript/src/move-trailing-comments/index.ts). They cover directives matched by [`BLOCK_DIRECTIVE_PATTERN`](../packages/prettier-plugin-typescript/src/constants/index.ts), trailing suppressions, and qualifying fall-through comments.

The conversion policy deliberately includes bare `eslint-disable` and `eslint-enable` (without `-line` or `-next-line`), their `oxlint-` forms, and ESLint configuration comments: `eslint` rule settings, `eslint-env`, `exported`, `global`, and `globals`. Converting `//` to `/* … */` can activate previously ignored settings or suppressions, giving ESLint directives the block form their authors presumably intended. A `// global …` line intended as prose can consequently become a declaration. This is an accepted consequence.

[ESLint 10 reports `/* eslint-env */` comments as errors](https://eslint.org/docs/latest/use/migrate-to-10.0.0#-eslint-env-comments-are-reported-as-errors). `eslint-env` is deliberately converted for consistency, with these errors accepted as a consequence.

Converting only the first line of an `eslint-disable` whose rules continue on indented lines below could suppress every rule. [`isContinuedList`](../packages/prettier-plugin-typescript/src/move-trailing-comments/index.ts) identifies continued lists.

### Formatting Stability

The extra formatting passes in [`wrapComments`](../packages/prettier-plugin-typescript/src/wrap-comments/index.ts) are intentional. Formatting first makes every edit use the lines Prettier prints. Formatting the edited code again keeps a directive as `//` when converting it would move it off the code it covers, and leaves a moved comment in its original place when Prettier would print it after code again.

When joining a line to a paragraph or collapsing its spaces would create a directive, the shared reflow engine’s [`parseNodes`](../packages/utilities/src/format-comment-block/index.ts) keeps that line as written on its own rather than starting a new reflowed paragraph with it. A new paragraph could wrap differently and move where the next run splits paragraphs.

### Next-Line Directives

[`NEXT_LINE_DIRECTIVE_PATTERN`](../packages/utilities/src/constants/index.ts) identifies directives whose meaning depends on the line immediately below them, including Semgrep’s `nosemgrep`, detect-secrets’ `pragma: allowlist nextline secret`, and cspell’s `cspell:disable-next-line`.

ShellCheck directives are deliberately excluded from this pattern. `# shellcheck disable=…` continues to apply across intervening comment lines, so moving a comment between the directive and its command doesn’t change the suppression.

The shell plugin keeps comments below `# prettier-ignore` in place, as the TypeScript plugin does for its ignore marker. `sh-syntax` still formats the command beneath the marker.

### TypeScript Limitations

The following limitations are accepted:

- A doc comment line containing `|` outside code spans and inline tags counts as a Markdown table row. Prose containing a bare `|` therefore isn’t reflowed.
- Comments in indented embeds, such as code blocks in Markdown list items, are measured from column 0 of the embedded code. The surrounding indentation can make the final lines exceed the requested print width.
- With `insertPragma`, when Prettier merges the pragma into an existing docblock, comment reflow waits until the next run.
