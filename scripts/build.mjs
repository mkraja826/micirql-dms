import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');

const files = [
  'index.html',
  'styles.css',
  'blog.css',
  'capdent-mark.svg',
  'social-card.svg',
  'robots.txt',
  'sitemap.xml',
  '_headers',
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await Promise.all([
  ...files.map((file) => copyFile(join(projectRoot, file), join(outputDir, file))),
  cp(join(projectRoot, 'blog'), join(outputDir, 'blog'), { recursive: true }),
]);

console.log('CapDent website and editorial guides built into dist/.');
