import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
var packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    return {
        root: 'src',
        base: '/psgrebrand/',
        plugins: [react()],
        define: {
            'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
            'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY),
            'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
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
    };
});
