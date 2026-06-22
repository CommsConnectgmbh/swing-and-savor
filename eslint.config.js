import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Flat config for the Swing & Savor web app.
//
// Scope: the React PWA in `src/` is linted with browser + React rules; the
// auxiliary Node/edge scripts (`api/`, `scripts/`, `discord/`, config files)
// get Node globals so they don't trip `no-undef`. Genuine correctness issues
// are errors; stylistic / known-debt rules (unused vars, effect deps) are
// warnings so the signal stays actionable without blocking the build.
export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      'pwa_build/**',
      'deploy_upload/**',
      'node_modules/**',
      'native/**',
      'public/**',
      'docs/**',
      'coverage/**',
      '**/*.min.js',
    ],
  },

  js.configs.recommended,

  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },

  // Application source — React + browser.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/jsx-no-target-blank': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

  // Test files — vitest helpers are imported explicitly, jsdom is the env.
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test-setup.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Node / edge scripts and tooling config.
  {
    files: [
      'api/**/*.{js,mjs}',
      'scripts/**/*.{js,mjs}',
      'discord/**/*.{js,mjs}',
      'screenshots/**/*.{js,mjs}',
      'marketing/**/*.{js,mjs}',
      '.apple-bootstrap/**/*.{js,cjs,mjs}',
      '*.config.js',
      '*.cjs',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'warn',
    },
  },
]
