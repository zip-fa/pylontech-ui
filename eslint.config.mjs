import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import nx from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import * as jsoncParser from 'jsonc-eslint-parser';
import jsoncPlugin from 'eslint-plugin-jsonc';
import eslintConfigPrettier from 'eslint-config-prettier';
import promisePlugin from 'eslint-plugin-promise';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '.nx/**',
      'index.html',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@nx': nx,
      import: importPlugin,
      promise: promisePlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            'tsconfig.base.json',
            'apps/*/tsconfig.json',
            'libs/*/tsconfig.json',
          ],
        },
        node: true,
      },
    },
    rules: {
      // Base TypeScript ESLint recommended rules
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/consistent-type-exports': [
        'error',
        { fixMixedExportsWithInlineTypeSpecifier: false },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public',
          overrides: {
            properties: 'explicit',
            parameterProperties: 'explicit',
          },
        },
      ],
      'padding-line-between-statements': [
        'error',

        // 1. Return statements
        // Always require a blank line BEFORE a `return`
        { blankLine: 'always', prev: '*', next: 'return' },

        // 2. Control Structures (if)
        // Always require a blank line BEFORE an `if` statement.
        { blankLine: 'always', prev: '*', next: 'if' },

        // Always require a blank line AFTER a block (if, for, while, switch, etc.)
        { blankLine: 'always', prev: 'block-like', next: '*' },

        // 3. Variables
        // Always require a blank line AFTER a group of variable declarations...
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        // ...but allow those variables to be stacked right next to each other.
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },

        // 4. Imports
        // Always require a blank line AFTER the import block
        { blankLine: 'always', prev: ['import', 'cjs-import'], next: '*' },
        {
          blankLine: 'any',
          prev: ['import', 'cjs-import'],
          next: ['import', 'cjs-import'],
        },
      ],
      'max-classes-per-file': 'off',
      yoda: 'off',
      'no-param-reassign': 'off',
      'dot-notation': 'off',
      'no-multi-assign': 'off',
      'promise/param-names': 'off',
      'function-call-argument-newline': ['error', 'always'],
      'function-paren-newline': ['error', { minItems: 4 }],
      'array-element-newline': ['error', { minItems: 3 }],
      'no-constant-binary-expression': ['error'],
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
        },
      ],
      'no-else-return': [
        'error',
        {
          allowElseIf: true,
        },
      ],
    },
  },

  // JSON files configuration
  {
    files: ['**/*.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc: jsoncPlugin },
    rules: {
      ...jsoncPlugin.configs.base.rules,
    },
  },

  // Nx module boundaries for all JS/TS files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      '@nx': nx,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },

  // React (apps/web is a Vite React app)
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // shadcn primitives are vendored verbatim and export their `cva` variants alongside
  // the component. That is the upstream shape; rewriting it would fork the files.
  {
    files: ['apps/web/src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Test files configuration
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
    rules: {},
  },

  eslintConfigPrettier,

  // Braces on every control-flow body. Jabka never wrote this down, but its TypeScript is 98.6%
  // braced and the exceptions all sit in one throwaway benchmark directory, so the convention is
  // real and only ever went unenforced. This has to sit after eslint-config-prettier, which
  // disables `curly` wholesale even though only its `multi-line` option ever fights Prettier.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs'],
    rules: {
      curly: ['error', 'all'],
    },
  },
];
