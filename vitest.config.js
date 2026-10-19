import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/cypress/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/hooks/**'],
      exclude: [
        'src/lib/colorUtils.js',
        'src/lib/dateUtils.js',
        'src/lib/devLogger.js',
        'src/lib/ecrGenerator.js',
        'src/lib/esicGenerator.js',
        'src/lib/form16Generator.js',
        'src/lib/leaveUtils.js',
        'src/lib/notifications.js',
        'src/lib/salaryRegister.js',
        'src/lib/sanitize.js',
        'src/lib/supabase.js',
      ],
      thresholds: { lines: 25, functions: 25, branches: 10, statements: 25 },
    },
  },
})
