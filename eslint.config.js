import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import ts from 'typescript-eslint'
import svelteConfig from './svelte.config.js'

export default defineConfig([
  js.configs.recommended,
  ...svelte.configs.recommended,
  {
    ignores: [
      'out/**',
      'dist/**',
      'coral-remote-server/**',
      'coral-visualizer/**',
      'coral/**',
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'], // Add support for additional file extensions
        parser: ts.parser,
        // We recommend importing and specifying svelte.config.js.
        // By doing so, some rules in eslint-plugin-svelte will automatically read the
        // configuration and adjust their behavior accordingly.
        // While certain Svelte settings may be statically loaded from svelte.config.js
        // even if you don’t specify it, explicitly specifying it ensures better
        // compatibility and functionality.
        svelteConfig,
      },
    },
  },
  {
    plugins: {},
    rules: {
      // Allow underscore-prefixed names to be declared but unused.
      // This is needed for callback parameter names in TypeScript interface definitions,
      // See: https://eslint.org/docs/latest/rules/no-unused-vars#argsignorepattern
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
])
