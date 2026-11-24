/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Para GitHub Pages, o app é servido em /<nome-do-repo>/.
// O workflow de deploy define BASE_PATH automaticamente.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
    coverage: { include: ['src/domain/**', 'src/data/**'] },
  },
});
