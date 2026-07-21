import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  root: 'src',
  base: '/rollouthq/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          icons: ['lucide-react'],
          leaflet: ['leaflet', 'react-leaflet'],
          query: ['@tanstack/react-query'],
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js', '@supabase/ssr'],
        },
      },
    },
  },
});
