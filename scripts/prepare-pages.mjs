import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.resolve(scriptDir, '..', 'dist');
const rootAssetsDir = path.join(projectRoot, 'assets');

async function tryRemove(pathToRemove) {
  try {
    await rm(pathToRemove, { recursive: true, force: true });
  } catch (error) {
    if (error?.code === 'EBUSY') {
      console.warn(`Skipped removing locked path: ${pathToRemove}`);
      return;
    }
    throw error;
  }
}

await tryRemove(rootAssetsDir);
await tryRemove(path.join(projectRoot, '404.html'));
await tryRemove(path.join(projectRoot, 'index.html'));

await mkdir(distDir, { recursive: true });
await copyFile(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));
await copyFile(path.join(distDir, 'index.html'), path.join(projectRoot, 'index.html'));
await copyFile(path.join(distDir, '404.html'), path.join(projectRoot, '404.html'));
await cp(path.join(distDir, 'assets'), rootAssetsDir, { recursive: true, force: true });

// Inject runtime config into dist/index.html so GitHub Pages can provide
// Supabase runtime values (when set via CI environment variables).
try {
  const indexPath = path.join(distDir, 'index.html');
  let indexHtml = await (await import('node:fs/promises')).readFile(indexPath, 'utf8');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const runtimeSnippet = `\n    <script>\n      window.__PSG_CONFIG__ = window.__PSG_CONFIG__ || {\n        VITE_SUPABASE_URL: '${supabaseUrl.replace(/'/g, "\\'")}',\n        VITE_SUPABASE_KEY: '${supabaseKey.replace(/'/g, "\\'")}',\n      };\n    </script>\n`;

  if (!indexHtml.includes('window.__PSG_CONFIG__')) {
    indexHtml = indexHtml.replace(/<\/head>/i, runtimeSnippet + '  </head>');
    await (await import('node:fs/promises')).writeFile(indexPath, indexHtml, 'utf8');
  }
} catch (err) {
  // Non-fatal; log and continue
  console.warn('Failed to inject runtime config into dist/index.html:', err?.message ?? err);
}