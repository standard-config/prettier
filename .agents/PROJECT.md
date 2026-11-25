# Project Documentation

This document records constraints, durable facts, maintenance decisions, and rationale that are not obvious from source and configuration. `AGENTS.md` remains authoritative for agent instructions.

## Architecture

### Override Plugin Lists

The JSON and `package.json` overrides deliberately omit the shell and TypeScript plugins. Prettier checks every option in effect for a file against its active plugins. That includes options from earlier matching overrides, such as the Markdown override’s `shUseTabs` setting.

When an override supplies a `plugins` list, even an empty one, the config prepends a plugin that declares the shell options (`sh*`) and `tsCommentWrap`. This prevents unknown option warnings when the list replaces the global plugins. Prettier uses the last declaration of each option, so the override’s own plugins take precedence. See [`transformConfig`](../packages/prettier/src/transform-config/index.ts).

### Oxc Parser Inference

The TypeScript plugin’s [`languages` export](../packages/prettier-plugin-typescript/src/index.ts) reuses Prettier’s JavaScript, JSX, TypeScript, and TSX definitions, changing only their parser lists. Prettier can then infer `oxc` or `oxc-ts` from the same extensions and file names, including `Jakefile`, without separate `parser` overrides in the base config.

When plugins declare the same file extension, Prettier checks later plugins first. A competing entry can select `babel` or `typescript`. Formatting tests can’t detect that fallback when both parsers produce identical output, so the [config’s inference test](../packages/prettier/src/define-config/index.test.ts) checks the parser name that `getFileInfo` infers from the config’s plugin list.

Prettier selects `babel` explicitly for plain `<script>` blocks in Vue and HTML and for MDX imports and exports. It selects `typescript` for HTML `<script type="application/x-typescript">` blocks. Wrapping both built-in parsers keeps comment reflow active in these embeds, which bypass file name inference.

### Oxc Parser Parity

The [**Oxc parser parity**](../AGENTS.md#plugins) rule preserves the formatting users get from Prettier’s built-in parsers. For example, `babel` keeps the parentheses in `/** @type {T} */ (obj.key) = value`. Using `@prettier/plugin-oxc` as the reference would drop them.

The parser names `oxc` and `oxc-ts` matter even when the syntax tree stays the same. Prettier recognizes a fixed set of parser names when it selects the statements to format in a range. Its `estree` printer also checks the parser name when deciding which property keys to quote.

Prettier’s printer reads the private `__contentEnd` field to locate the end of a statement’s content before its semicolon. The [statement-end cases](../packages/prettier-plugin-typescript/src/oxc-parity-cases/index.ts) compare comment placement and the text preserved by `prettier-ignore` across both parsers in a pair. The published config’s Prettier peer range starts at the oldest version verified with these private printer conventions.

Prettier’s built-in parsers merge two multi-line block comments when their delimiters touch and every line of each block starts with `*`, ignoring indentation and the `/` at each end of the block. The star in a plain `/*` opener counts. The adapter preserves that grouping because comment reflow depends on receiving the pair as one comment. The single block containing `foo //** bar` in the [reflow test](../packages/prettier-plugin-typescript/src/index.test.ts) is intentional.

With reflow off, the parser parity tests require output to stay identical on a second pass. With reflow on, the first pass can move a trailing line comment above a JSDoc comment. The next pass can then expand the JSDoc comment because it now occupies a line of its own. This happens even with a built-in parser, so the plugin tests compare each Oxc pass with the corresponding pass through the wrapped built-in parser.

The `~` range for `oxc-parser` admits patch fixes. A new minor release can change the syntax tree, so adopting it calls for checking parity again. For each new type in the parser’s `visitorKeys`, the [node-type coverage test](../packages/prettier-plugin-typescript/src/create-oxc-parser/index.test.ts) requires a parity case that produces it unless the test documents an exception. From the repository root, `pnpm test:oxc-parser` compares one formatting pass per parser on JavaScript and TypeScript files in installed dependencies, using the config’s formatting options with comment reflow off.

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

### Scheduler Directives

The shell plugin preserves lines matched by [`SCHEDULER_DIRECTIVE_PATTERN`](../packages/prettier-plugin-shell/src/constants/index.ts), including Slurm’s `#SBATCH hetjob` separator. Joining that line to an option would erase the boundary between job components. Disabled directives also keep their spacing and line breaks so an author can re-enable a single option, for example by removing the space in `# SBATCH --time=01:00:00`.

Torque reads the line after a PBS directive’s trailing backslash as part of the directive, even when that line has no `#PBS` marker. The plugin preserves every comment line in the continuation and avoids moving a trailing comment into it.

Flux requires the same directive sentinel on every line of a triple-quoted value, including the closing line. Recognizing the `flux:` or `FLUX:` tag on each line therefore preserves the entire value. See the [Flux submission directive specification](https://flux-framework.readthedocs.io/projects/flux-rfc/en/latest/spec_36.html).

### TypeScript Limitations

The following limitations are accepted:

- A doc comment line containing `|` outside code spans and inline tags counts as a Markdown table row. Prose containing a bare `|` therefore isn’t reflowed.
- Comments in indented embeds, such as code blocks in Markdown list items, are measured from column 0 of the embedded code. The surrounding indentation can make the final lines exceed the requested print width.
- With `insertPragma`, when Prettier merges the pragma into an existing docblock, comment reflow waits until the next run.
