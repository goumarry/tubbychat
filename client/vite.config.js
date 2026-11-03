import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// En développement (npm run dev), on renvoie /api et /ws vers l'application lancée par docker compose.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8090',
      '/ws': { target: 'ws://localhost:8090', ws: true },
    },
  },
});
