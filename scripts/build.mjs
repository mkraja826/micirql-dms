import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await Promise.all([
  copyFile(join(projectRoot, 'index.html'), join(outputDir, 'index.html')),
  copyFile(join(projectRoot, 'styles.css'), join(outputDir, 'styles.css')),
  copyFile(join(projectRoot, 'capdent-mark.svg'), join(outputDir, 'capdent-mark.svg')),
  copyFile(join(projectRoot, 'robots.txt'), join(outputDir, 'robots.txt')),
  copyFile(join(projectRoot, 'sitemap.xml'), join(outputDir, 'sitemap.xml')),
  cp(join(projectRoot, 'images'), join(outputDir, 'images'), { recursive: true }),
]);

console.log('CapDent SEO website built into dist/.');
