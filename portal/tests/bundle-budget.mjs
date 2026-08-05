import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const assetsDir = new URL('../../dist/portal/assets/', import.meta.url);
const files = await readdir(assetsDir);
const javascript = [];
const stylesheets = [];

for (const name of files) {
  const size = (await stat(join(assetsDir.pathname, name))).size;
  if (name.endsWith('.js')) javascript.push({ name, size });
  if (name.endsWith('.css')) stylesheets.push({ name, size });
}

if (javascript.length < 6) {
  throw new Error(`Expected at least 6 cacheable JavaScript chunks, found ${javascript.length}.`);
}

const oversizedJavaScript = javascript.filter((file) => file.size > 300_000);
if (oversizedJavaScript.length) {
  throw new Error(`JavaScript bundle budget exceeded: ${oversizedJavaScript.map((file) => `${file.name}=${file.size}`).join(', ')}`);
}

const oversizedStyles = stylesheets.filter((file) => file.size > 120_000);
if (oversizedStyles.length) {
  throw new Error(`CSS bundle budget exceeded: ${oversizedStyles.map((file) => `${file.name}=${file.size}`).join(', ')}`);
}

const totalJavaScript = javascript.reduce((sum, file) => sum + file.size, 0);
console.log(`Clinic Admin bundle budget passed: ${javascript.length} JS chunks, ${totalJavaScript} total bytes.`);
