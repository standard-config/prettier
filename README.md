[![](https://img.shields.io/npm/v/%40standard-config%2Fprettier)](https://www.npmjs.com/package/@standard-config/prettier)
[![](https://img.shields.io/github/actions/workflow/status/standard-config/prettier/test.yaml)](https://github.com/standard-config/prettier/actions/workflows/test.yaml)
[![](https://img.shields.io/codecov/c/github/standard-config/prettier)](https://codecov.io/github/standard-config/prettier)

# @standard-config/prettier

TypeScript-first Prettier config with carefully considered details.

- Uses the [`oxc` parser](https://oxc.rs/docs/guide/usage/parser.html) for lightning-fast TypeScript and JavaScript formatting.
- Formats shell scripts out of the box, including `git` hook files.
- Sorts all JSON files, with sensible order patterns for common configs like `package.json`, `tsconfig.json`, `.oxlintrc.json`, and more.

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

You can override the defaults by passing your own [config options](https://prettier.io/docs/options).

```ts
import { defineConfig } from '@standard-config/prettier';

export default defineConfig({
    useTabs: false,
});
```

### .editorconfig

For a consistent editor experience, you can use the included `.editorconfig`, aligned with the Prettier configuration.

```sh
ln -s node_modules/@standard-config/prettier/.editorconfig
```

## License

MIT © [Dom Porada](https://dom.engineering)
