import { defineConfig } from '@standard-config/prettier';
import * as pluginShellComments from 'prettier-plugin-shell-comments';

export default defineConfig({
	plugins: [pluginShellComments],
});
