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