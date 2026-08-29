/** @type {import('prettier').Config} */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  endOfLine: 'lf',
  plugins: ['prettier-plugin-tailwindcss'],
  // Tailwind v4 has no config file; the plugin reads the theme from the CSS entry point.
  tailwindStylesheet: './apps/web/src/index.css',

  overrides: [
    {
      files: ['*.ts', '*.cts', '*.mts', '*.tsx'],
      options: {
        printWidth: 80,
        tabWidth: 2,
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
        bracketSpacing: true,
        arrowParens: 'always',
      },
    },

    {
      files: ['*.js', '*.cjs', '*.mjs', '*.jsx'],
      options: {
        printWidth: 80,
        tabWidth: 2,
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
        bracketSpacing: true,
      },
    },

    {
      files: ['*.html', '*.htm'],
      options: {
        printWidth: 80,
        tabWidth: 2,
        singleAttributePerLine: true,
        bracketSameLine: false,
        htmlWhitespaceSensitivity: 'css',
      },
    },

    {
      files: '*.css',
      options: {
        printWidth: 120,
        tabWidth: 2,
        singleQuote: true,
      },
    },

    {
      files: '*.scss',
      options: {
        printWidth: 120,
        tabWidth: 2,
        singleQuote: false,
      },
    },

    {
      files: ['*.json', '*.jsonc'],
      options: {
        printWidth: 120,
        tabWidth: 2,
        trailingComma: 'none',
      },
    },

    {
      files: ['*.yaml', '*.yml'],
      options: {
        printWidth: 120,
        tabWidth: 2,
        singleQuote: true,
      },
    },

    {
      files: ['*.md', '*.markdown'],
      options: {
        tabWidth: 4,
        proseWrap: 'always',
      },
    },
  ],
};
