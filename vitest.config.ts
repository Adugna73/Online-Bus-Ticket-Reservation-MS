import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.{spec,test}.{ts,tsx}'],
    exclude: ['node_modules/**', '.kilo/**', '.next/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'app/api/**/route.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
})
