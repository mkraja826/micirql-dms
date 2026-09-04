import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(dir, 'interaction-certification-v2.mjs');
const runtimePath = join(dir, '.interaction-certification-runtime.mjs');
let patched = readFileSync(sourcePath, 'utf8');

const galleryMarker = "await page.getByRole('button',{name:'Archive file',exact:true}).click(); expectRpc('admin_set_file_archived');";
if (!patched.includes(galleryMarker)) throw new Error('Gallery interaction marker changed; update the certification runner.');
patched = patched.replace(galleryMarker, `${galleryMarker} await page.getByRole('button',{name:'Close gallery details',exact:true}).click();`);

const settingsMarker = "await nav(page,'Clinic settings'); await page.getByLabel('Modification reason').fill('Interaction certification');";
if (!patched.includes(settingsMarker)) throw new Error('Clinic settings interaction marker changed; update the certification runner.');
patched = patched.replace(settingsMarker, "await nav(page,'Clinic settings'); await page.getByLabel('Settings-change reason').fill('Interaction certification');");

const settingsSubmitMarker = "await page.locator('.management-settings button[type=\"submit\"]').click();";
if (!patched.includes(settingsSubmitMarker)) throw new Error('Clinic settings save marker changed; update the certification runner.');
patched = patched.replace(settingsSubmitMarker, "await page.getByRole('button',{name:'Save audited settings',exact:true}).click();");

const printMarker = "if(!await page.evaluate(()=>Boolean(window.__capdentPrinted))) throw new Error('Print / Save PDF did not invoke window.print().');";
if (!patched.includes(printMarker)) throw new Error('Print interaction marker changed; update the certification runner.');
patched = patched.replace(printMarker, "await page.waitForFunction(()=>Boolean(window.__capdentPrinted));");

writeFileSync(runtimePath, patched, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  try { unlinkSync(runtimePath); } catch {}
}
