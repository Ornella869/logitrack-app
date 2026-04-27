import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    clearMocks: true,
    restoreMocks: true,
  },
})
