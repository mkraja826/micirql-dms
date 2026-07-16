import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await Promise.all([
  copyFile(join(projectRoot, 'index.html'), join(outputDir, 'index.html')),
  copyFile(join(projectRoot, 'capdent-mark.svg'), join(outputDir, 'capdent-mark.svg')),
]);

console.log('CapDent static site built into dist/.');
