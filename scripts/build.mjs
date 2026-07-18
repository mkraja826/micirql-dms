import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, 'dist');
const marketingOrigin = 'https://capdent.in';
const appOrigin = 'https://app.capdent.in';
const brandAsset = '/capdent-mark.svg?v=20260719';

const publicFiles = [
  'index.html',
  'capdent-mark.svg',
  'social-card.svg',
  'robots.txt',
  'sitemap.xml',
  '_headers',
];

const releaseNotice = `<aside class="release-notice" role="status" aria-label="CapDent release update">
  <div class="release-notice-track">
    <span><strong>Release update</strong><i aria-hidden="true">•</i>Android app has 13 days remaining in its testing phase<i aria-hidden="true">•</i>iOS will be released based on customer demand</span>
    <span aria-hidden="true"><strong>Release update</strong><i>•</i>Android app has 13 days remaining in its testing phase<i>•</i>iOS will be released based on customer demand</span>
  </div>
</aside>`;

const brandImage = `<img class="brand-mark" src="${brandAsset}" alt="" width="40" height="40">`;
const faviconLink = `<link rel="icon" href="${brandAsset}" type="image/svg+xml">`;

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

// The portal is compiled after this script. Give it the same favicon and logo
// without changing its application logic or dashboard layout.
const portalIndexPath = join(projectRoot, 'portal', 'index.html');
let portalIndex = await readFile(portalIndexPath, 'utf8');
portalIndex = portalIndex.replace(/<link\s+rel=["']icon["'][^>]*>/i, faviconLink);
if (!portalIndex.includes('data-capdent-brand')) {
  portalIndex = portalIndex.replace(
    '</head>',
    `  <style data-capdent-brand>html body .brand-mark{overflow:hidden;background:#fff url('${brandAsset}') center/contain no-repeat!important;box-shadow:none!important}html body .brand-mark svg{display:none!important}</style>\n  </head>`,
  );
}
await writeFile(portalIndexPath, portalIndex, 'utf8');

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

  // Replace every legacy inline mark and add the mark to text-only blog headers.
  source = source.replace(/<svg class="brand-mark"[\s\S]*?<\/svg>/g, brandImage);
  source = source.replace(
    /(<a class="brand(?: footer-brand)?"[^>]*>)(?!\s*<img class="brand-mark")/g,
    `$1${brandImage}`,
  );

  if (/<link\s+rel=["']icon["'][^>]*>/i.test(source)) {
    source = source.replace(/<link\s+rel=["']icon["'][^>]*>/i, faviconLink);
  } else {
    source = source.replace('</head>', `  ${faviconLink}\n</head>`);
  }

  source = source.replace('</header>', `</header>\n${releaseNotice}`);

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

console.log(`CapDent marketing site built for ${marketingOrigin} with the new logo, favicon, separate login links and release notice across ${htmlFiles.length} HTML pages.`);
