import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src',
  base: '/rebrandreport/',
  plugins: [react()],
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
