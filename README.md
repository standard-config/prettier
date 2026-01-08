# @standard-config/prettier

Curated Prettier config for modern TypeScript projects.

- Enables the [`oxc` parser](https://oxc.rs/docs/guide/usage/parser.html) for lightning-fast TypeScript formatting.
- Sorts all JSON files, with curated order patterns for common config files: `package.json`, `tsconfig.json`, `.oxlintrc.json`, and more.

## Install

```sh
npm install --save-dev @standard-config/prettier
```

```sh
pnpm add --save-dev @standard-config/prettier
```

## Usage

Create your `prettier.config.ts`:

```ts
import { defineConfig } from '@standard-config/prettier';

export default defineConfig();
```

Optionally, pass your own [config options](https://prettier.io/docs/options) to overwrite the [package defaults](src/config.ts):

```ts
import { defineConfig } from '@standard-config/prettier';

export default defineConfig({
	semi: false,
});
```
