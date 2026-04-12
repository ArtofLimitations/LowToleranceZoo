// ltz.js — Low Tolerance Zoo project archive (.ltz) read/write
// A .ltz file is a standard ZIP archive with a renamed extension.
// Internal structure:
//   manifest.json   — master index of everything in the project
//   world.json      — existing world/board/spritesheet data
//   audio/          — (future) OGG/MP3/WAV files
//     music/
//     sfx/

import { zipSync, unzipSync, strToU8, strFromU8 } from './modules/fflate.js';

// Current format version — bump this when the structure changes
const LTZ_VERSION = 1;

// ─────────────────────────────────────────────
// Build a .ltz Uint8Array from a world data object.
// worldData  — the same object that saveWorld() currently serialises to JSON
// projectName — shown in manifest, used as a default filename hint
// ─────────────────────────────────────────────
export function packLtz(worldData, projectName = 'project') {
    const manifest = {
        version: LTZ_VERSION,
        name: projectName,
        files: {
            world: 'world.json',
        },
        audio: {
            music: {},
            sfx: {},
        },
    };

    const worldJson  = JSON.stringify(worldData);          // same JSON as before
    const manifestJson = JSON.stringify(manifest, null, 2);

    // Build the ZIP file table: { filename: Uint8Array }
    const zipEntries = {
        'manifest.json': strToU8(manifestJson),
        'world.json':    strToU8(worldJson),
    };

    return zipSync(zipEntries, { level: 6 }); // returns Uint8Array
}

// ─────────────────────────────────────────────
// Unpack a .ltz Uint8Array.
// Returns { manifest, worldData } on success, throws on error.
// ─────────────────────────────────────────────
export function unpackLtz(bytes) {
    const files = unzipSync(bytes); // { filename: Uint8Array }

    if (!files['manifest.json']) {
        throw new Error('Not a valid .ltz file: missing manifest.json');
    }
    if (!files['world.json']) {
        throw new Error('Not a valid .ltz file: missing world.json');
    }

    const manifest  = JSON.parse(strFromU8(files['manifest.json']));
    const worldData = JSON.parse(strFromU8(files['world.json']));

    return { manifest, worldData, rawFiles: files };
}

// ─────────────────────────────────────────────
// Trigger a browser download of a Uint8Array as a named file.
// ─────────────────────────────────────────────
export function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// ─────────────────────────────────────────────
// Open a file-picker restricted to .ltz files.
// Returns a Promise<{ manifest, worldData, rawFiles }>.
// ─────────────────────────────────────────────
export function openLtzDialog() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ltz';

        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return reject(new Error('No file selected'));

            try {
                const buffer = await file.arrayBuffer();
                const result = unpackLtz(new Uint8Array(buffer));
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });

        input.click();
    });
}

// ─────────────────────────────────────────────
// Quick round-trip smoke test — call from the browser console:
//   import('./js/ltz.js').then(m => m.ltzSelfTest())
// Should log "ltz self-test PASSED" if everything is working.
// ─────────────────────────────────────────────
export function ltzSelfTest() {
    const testData = {
        spritesheet: [[1, 2, 3]],
        boards: { 1: { hello: 'world' } },
        world: {},
        worldSettings: {},
        boardSettings: {},
    };

    try {
        const packed   = packLtz(testData, 'self-test');
        const unpacked = unpackLtz(packed);

        const ok = JSON.stringify(unpacked.worldData) === JSON.stringify(testData)
                && unpacked.manifest.version === LTZ_VERSION
                && unpacked.manifest.name === 'self-test';

        console.log(ok ? '✅ ltz self-test PASSED' : '❌ ltz self-test FAILED — data mismatch');
        console.log('  packed size:', packed.length, 'bytes');
        console.log('  manifest:', unpacked.manifest);
        return ok;
    } catch (e) {
        console.error('❌ ltz self-test threw:', e);
        return false;
    }
}
