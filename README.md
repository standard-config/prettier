<p align="center">
    <a href="https://github.com/standard-config/prettier">
        <img
            src="https://github.com/standard-config/.github/blob/main/.github/assets/standard-config-prettier@3x.png?raw=true"
            width="500"
            alt=""
        />
    </a>
</p>

<h1 align="center">@standard&#8209;config/prettier</h1>

<p align="center">TypeScript-first Prettier&nbsp;config.</p>

<p align="center">
    <a href="https://npmx.dev/package/@standard-config/prettier"
        ><img
            src="https://img.shields.io/npm/v/%40standard-config%2Fprettier?style=flat-square"
            alt=""
    /></a>
    <a href="https://github.com/standard-config/prettier/actions/workflows/test.yaml"
        ><img
            src="https://img.shields.io/github/actions/workflow/status/standard-config/prettier/test.yaml?style=flat-square"
            alt=""
    /></a>
    <a href="https://codecov.io/github/standard-config/prettier"
        ><img
            src="https://img.shields.io/codecov/c/github/standard-config/prettier?style=flat-square"
            alt=""
    /></a>
</p>

<div>&nbsp;</div>

## Overview

TypeScript-first Prettier config with carefully considered details.

- Uses the [Oxc parser](https://oxc.rs/docs/guide/usage/parser.html) for lightning-fast TypeScript and JavaScript formatting.
- Formats shell scripts out of the box.
- Formats HTML fragments in GitHub-Flavored Markdown documents.
- Sorts all JSON files, with curated order patterns for common config files like `package.json`, `tsconfig.json`, and more.

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
    printWidth: 100,
});
```

### .editorconfig

For a consistent editor experience, you can use the included [`.editorconfig`](https://editorconfig.org) file in addition to the Prettier configuration.

```sh
ln -s node_modules/@standard-config/prettier/.editorconfig
```

## Related

- [**@standard-config/oxlint**](https://github.com/standard-config/oxlint)
- [**@standard-config/tsconfig**](https://github.com/standard-config/tsconfig)
- [**prettier-plugin-expand-json**](https://github.com/porada/prettier-plugin-expand-json)
- [**prettier-plugin-markdown-html**](https://github.com/porada/prettier-plugin-markdown-html)
- [**prettier-plugin-yaml**](https://github.com/porada/prettier-plugin-yaml)

## License

MIT © [Dom Porada](https://dom.engineering)
