import { defineConfig } from 'vitest/config';

// Vite's frontend root is src/web; tests and data belong to the repository root.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
