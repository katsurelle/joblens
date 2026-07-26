import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/types/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.dom.test.ts',
      ],
      thresholds: {
        // Floor for the triage core — raise as gaps close; do not lower without reason.
        lines: 70,
        statements: 68,
        functions: 65,
        branches: 52,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          setupFiles: ['./tests/setup.ts'],
          include: [
            'src/**/*.test.ts',
            'tests/contracts/**/*.test.ts',
          ],
          exclude: ['src/**/*.dom.test.ts', '**/*.test.tsx', '**/*.e2e.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/integration/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'e2e',
          environment: 'node',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/e2e/**/*.e2e.test.ts'],
          exclude: ['tests/e2e/**/*.dom.e2e.test.ts'],
        },
      },
      {
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: [
            'src/**/*.dom.test.ts',
            'src/**/*.test.tsx',
            'tests/**/*.test.tsx',
            'tests/e2e/**/*.dom.e2e.test.ts',
          ],
        },
      },
    ],
  },
});
