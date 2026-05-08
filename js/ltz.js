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
// In-memory audio store: { 'audio/sfx/coin.ogg': Uint8Array, ... }
// Populated by addAudioToStore(); bundled into the ZIP on save.
// ─────────────────────────────────────────────
const _audioStore = {};

export function addAudioToStore(category, name, bytes) {
    const key = `audio/${category}/${name}`;
    _audioStore[key] = bytes;
    return key;
}

export function removeAudioFromStore(key) {
    delete _audioStore[key];
}

export function getAudioStore() {
    return _audioStore;
}

export function clearAudioStore() {
    for (const k in _audioStore) delete _audioStore[k];
}

// ─────────────────────────────────────────────
// Build a .ltz Uint8Array from a world data object.
// worldData  — the same object that saveWorld() currently serialises to JSON
// projectName — shown in manifest, used as a default filename hint
// ─────────────────────────────────────────────
export function packLtz(worldData, projectName = 'project') {
    const audioManifest = { music: {}, sfx: {} };

    // Collect audio store entries into manifest
    for (const path in _audioStore) {
        // path is like 'audio/sfx/coin.ogg' or 'audio/music/theme.ogg'
        const parts = path.split('/');
        const cat   = parts[1]; // 'sfx' or 'music'
        const file  = parts.slice(2).join('/');
        if (cat === 'music') audioManifest.music[file] = path;
        else if (cat === 'sfx') audioManifest.sfx[file] = path;
    }

    const manifest = {
        version: LTZ_VERSION,
        name: projectName,
        files: {
            world: 'world.json',
        },
        audio: audioManifest,
    };

    const worldJson    = JSON.stringify(worldData);
    const manifestJson = JSON.stringify(manifest, null, 2);

    // Build the ZIP file table: { filename: Uint8Array }
    const zipEntries = {
        'manifest.json': strToU8(manifestJson),
        'world.json':    strToU8(worldJson),
    };

    // Bundle all audio files
    for (const [path, bytes] of Object.entries(_audioStore)) {
        zipEntries[path] = bytes;
    }

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

    // Restore audio files into the in-memory store
    clearAudioStore();
    for (const path in files) {
        if (path.startsWith('audio/')) {
            _audioStore[path] = files[path];
        }
    }

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
// Open a file-picker that accepts .ltz (new) and .json (legacy).
// Detects the file type by extension and parses accordingly.
// Returns a Promise<{ manifest, worldData, rawFiles, isLegacy }>.
// isLegacy is true when a plain .json file was loaded.
// ─────────────────────────────────────────────
export function openLtzDialog() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ltz,.json';

        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return reject(new Error('No file selected'));

            try {
                const isLegacy = file.name.toLowerCase().endsWith('.json');

                if (isLegacy) {
                    // Plain JSON world file — parse directly
                    const text = await file.text();
                    const worldData = JSON.parse(text);
                    resolve({ manifest: null, worldData, rawFiles: null, isLegacy: true });
                } else {
                    // .ltz ZIP archive
                    const buffer = await file.arrayBuffer();
                    const result = unpackLtz(new Uint8Array(buffer));
                    resolve({ ...result, isLegacy: false });
                }
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
