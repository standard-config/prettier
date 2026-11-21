import { defineConfig } from '@standard-config/prettier';
import * as pluginTypeScript from 'prettier-plugin-typescript';

export default defineConfig({
	plugins: [
		/* prettier-ignore */
		pluginTypeScript,
	],
});
