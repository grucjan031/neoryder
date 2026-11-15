import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    testTimeout: 20000,
    include: ['tests/unit/**/*.test.ts'],
  },
});
