import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist', '**/coverage', '**/node_modules']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSEnumDeclaration', message: 'Use a string-literal union or an `as const` object instead of enum.' },
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' },
      ],
    },
  },

  {
    files: ['game/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ['api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    // Tool config files must use default exports.
    files: ['**/*.config.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
