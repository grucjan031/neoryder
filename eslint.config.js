import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.npm-cache/**',
      '.cargo-home/**',
      '.wasm-pack-cache/**',
      'rust/**/target/**',
      'src/wasm/neoryder-sim/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**'],
    ignores: ['src/vfx/**', 'src/render/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Użyj seedowanego Rng.',
        },
      ],
    },
  },
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              allowTypeImports: true,
              message: 'Core dopuszcza wyłącznie import type z three.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
