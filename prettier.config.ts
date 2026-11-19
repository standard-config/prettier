import { defineConfig } from '@standard-config/prettier';
import * as pluginShell from 'prettier-plugin-shell';

export default defineConfig({
	plugins: [pluginShell],
});
