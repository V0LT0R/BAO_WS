import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['client/**/*.test.{js,jsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
});
