import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');
const marketingOrigin = 'https://capdent.in';
const appOrigin = 'https://app.capdent.in';

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

  source = source.replaceAll('https://capdent.micirql.com', marketingOrigin);

  // Remove the earlier app URL that was incorrectly labelled as Clinic Login.
  source = source.replace(
    /<a\s+href=["']https:\/\/app\.capdent\.in\/?["'][^>]*>\s*Clinic Login\s*<\/a>/gi,
    '',
  );

  source = source.replace(
    /<a class="header-cta"([^>]*)>Get CapDent<\/a>/,
    `<div class="header-actions"><a class="portal-cta" href="/portal/">Clinic Login</a><a class="app-cta" href="${appOrigin}/">App Login</a><a class="header-cta"$1>Get CapDent</a></div>`,
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

await Promise.all(['robots.txt', 'sitemap.xml'].map(async (file) => {
  const path = join(outputDir, file);
  const source = await readFile(path, 'utf8');
  await writeFile(path, source.replaceAll('https://capdent.micirql.com', marketingOrigin), 'utf8');
}));

console.log(`CapDent marketing site built for ${marketingOrigin} with separate clinic and app login links across ${htmlFiles.length} HTML pages.`);
