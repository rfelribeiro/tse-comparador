import { defineConfig } from 'vite';

// Configuração padrão do Vite.
export default defineConfig({
  base: '/',
  build: { chunkSizeWarningLimit: 800 },
});
