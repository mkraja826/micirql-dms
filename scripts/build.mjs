import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');

const publicFiles = [
  'index.html',
  'capdent-mark.svg',
  'social-card.svg',
  'robots.txt',
  'sitemap.xml',
  '_headers',
];

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findHtmlFiles(path);
    return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
  }));

  return files.flat();
}

const [siteCss, blogCss, portalNavCss] = await Promise.all([
  readFile(join(projectRoot, 'styles.css'), 'utf8'),
  readFile(join(projectRoot, 'blog.css'), 'utf8'),
  readFile(join(projectRoot, 'portal-nav.css'), 'utf8'),
]);

const inlineCss = `${siteCss}\n${blogCss}\n${portalNavCss}`;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await Promise.all([
  ...publicFiles.map((file) => copyFile(join(projectRoot, file), join(outputDir, file))),
  cp(join(projectRoot, 'blog'), join(outputDir, 'blog'), { recursive: true }),
]);

const htmlFiles = await findHtmlFiles(outputDir);
await Promise.all(htmlFiles.map(async (file) => {
  let source = await readFile(file, 'utf8');

  source = source.replace(
    /<a class="header-cta"([^>]*)>Get CapDent<\/a>/,
    '<div class="header-actions"><a class="portal-cta" href="https://app.capdent.in/">Clinic Login</a><a class="header-cta"$1>Get CapDent</a></div>',
  );

  const withoutExternalCss = source.replace(
    /\s*<link\s+rel=["']stylesheet["']\s+href=["']\/(?:styles|blog)\.css(?:\?[^"']*)?["']\s*\/?>/gi,
    '',
  );
  const optimized = withoutExternalCss.replace(
    '</head>',
    `  <style data-capdent-critical>${inlineCss}</style>\n</head>`,
  );
  await writeFile(file, optimized, 'utf8');
}));

console.log(`CapDent marketing site built with CSS inlined into ${htmlFiles.length} HTML pages.`);
