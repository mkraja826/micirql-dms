import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(dir, 'interaction-certification-v2.mjs');
const runtimePath = join(dir, '.interaction-certification-runtime.mjs');
const source = readFileSync(sourcePath, 'utf8');
const marker = "await page.getByRole('button',{name:'Archive file',exact:true}).click(); expectRpc('admin_set_file_archived');";
if (!source.includes(marker)) throw new Error('Gallery interaction marker changed; update the certification runner.');
const patched = source.replace(marker, `${marker} await page.getByRole('button',{name:'Close gallery details',exact:true}).click();`);
writeFileSync(runtimePath, patched, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  try { unlinkSync(runtimePath); } catch {}
}
