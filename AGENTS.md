# Agent Instructions

## Overview

- **Repository:** Contains the shareable Prettier config.
- **Layout:** `packages/prettier` publishes `@standard-config/prettier`. `packages/prettier-plugin-shell` is a private wrapper around `prettier-plugin-sh`, and `packages/prettier-plugin-typescript` is a private Prettier plugin. `packages/utilities` contains the private `@standard-config/utilities` package, and `packages/tests` holds fixtures.
- **Disclosure:** The repository is public and open source.

## Agent Documentation

| Source | Authority and Ownership |
| --- | --- |
| `AGENTS.md` | Defines project instructions, scope, and documentation authority. Applicable project instructions override global defaults. |
| `.agents/PROJECT.md` | Records constraints, durable facts, maintenance decisions, and rationale. It doesn’t override agent instructions. |

## General

- **Navigation:** Consult the relevant sections of `.agents/PROJECT.md`.
- **Durable knowledge:** Add project knowledge to `.agents/PROJECT.md` only when its absence would likely cause a wrong future decision or substantial repeated investigation. Capture non-obvious constraints and rationale not already clear from canonical configuration, instructions, or source. Don’t record optimization recaps, routine implementation details, or workflow summaries. Prefer updating existing material over adding another explanation. If the task doesn’t permit the edit, report deferred documentation work only if it meets this threshold.

## Compatibility

- **Node.js compatibility:** Keep code bundled into `@standard-config/prettier`, including utilities, compatible with the Node.js range declared in [`packages/prettier/package.json`](packages/prettier/package.json). See the [engine range rationale](.agents/PROJECT.md#nodejs-engine-ranges).

## Plugins

- **Shared constants:** Keep `@standard-config/utilities/constants` free of work at module load beyond defining constants. Any dependency must be loadable by both the shell and TypeScript plugins. See the [module load rationale](.agents/PROJECT.md#shared-constants-without-module-load-work).
- **Directive behavior:** Preserve the accepted [directive conversion policy](.agents/PROJECT.md#directive-conversion) and the line covered by [next-line directives](.agents/PROJECT.md#next-line-directives) when moving or reflowing comments. Keep reflow from creating directives or changing meaning on later runs. See the [formatting stability rationale](.agents/PROJECT.md#formatting-stability).
- **Shebang spacing:** Preserve the plugins’ different behavior after a shebang. See the [shebang spacing decision](.agents/PROJECT.md#shebang-spacing).
