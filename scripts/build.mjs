import { copyFile, cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');

const rootAssets = [
  'capdent-dashboard-v3.webp',
  'capdent-poster-sprite-v3.webp',
  'capdent-social-v3.webp',
  'capdent-product-screens-v3.webp',
];

async function assertWebP(fileName) {
  const filePath = join(projectRoot, fileName);
  const info = await stat(filePath);
  if (info.size < 16) throw new Error(`${fileName} is unexpectedly small.`);
  const header = await readFile(filePath);
  const riff = header.subarray(0, 4).toString('ascii');
  const webp = header.subarray(8, 12).toString('ascii');
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    throw new Error(`${fileName} is not a valid WebP asset.`);
  }
}

await Promise.all(rootAssets.map(assertWebP));
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await Promise.all([
  copyFile(join(projectRoot, 'index.html'), join(outputDir, 'index.html')),
  copyFile(join(projectRoot, 'styles.css'), join(outputDir, 'styles.css')),
  copyFile(join(projectRoot, 'asset-fix.css'), join(outputDir, 'asset-fix.css')),
  copyFile(join(projectRoot, 'capdent-mark.svg'), join(outputDir, 'capdent-mark.svg')),
  copyFile(join(projectRoot, 'robots.txt'), join(outputDir, 'robots.txt')),
  copyFile(join(projectRoot, 'sitemap.xml'), join(outputDir, 'sitemap.xml')),
  cp(join(projectRoot, 'images'), join(outputDir, 'images'), { recursive: true }),
  ...rootAssets.map((fileName) => copyFile(join(projectRoot, fileName), join(outputDir, fileName))),
]);

console.log('CapDent website built into dist/ with verified root WebP assets.');
