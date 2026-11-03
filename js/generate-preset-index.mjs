import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const presetsDirectory = join(projectRoot, 'assets', 'presets');
const manifestPath = join(presetsDirectory, 'index.json');
const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);

const files = (await readdir(presetsDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && imageExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

await writeFile(manifestPath, `${JSON.stringify(files, null, 2)}\n`);
console.log(`Wrote ${files.length} preset image(s) to assets/presets/index.json`);
