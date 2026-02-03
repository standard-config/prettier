import { defineConfig } from '@standard-config/eslint';
import { globalIgnores } from 'eslint/config';

export default defineConfig(globalIgnores(['fixtures/**']));
