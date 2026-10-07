// Verifies the ESM interop fix on the vendored howler.js, and that the
// format map in js/audio.js only emits codecs this build of Howler knows.
//
// Playback itself is NOT exercised here: Howler needs a real Web Audio or
// HTML5 Audio backend and Node has neither, so `Howler.noAudio` is true and
// every Howl aborts before it ever looks at a source.
//
//   node js/howler-interop.test.mjs

import { readFileSync } from 'node:fs';
import { Howl, Howler } from './modules/howler.js';

let failed = 0;
const check = (name, pass, detail = '') => {
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

// ── 1. ESM exports resolve ────────────────────────────────────────────
check('Howl is a function', typeof Howl === 'function');
check('Howler is an object', typeof Howler === 'object' && Howler !== null);
check('Howler.ctx is null in Node (no audio backend)', Howler.ctx === null);

// ── 2. The API surface js/audio.js depends on ─────────────────────────
for (const m of ['play', 'pause', 'stop', 'fade', 'volume', 'loop', 'once', 'on', 'off', 'unload', 'state', 'seek', 'duration']) {
    check(`Howl.prototype.${m}()`, typeof Howl.prototype[m] === 'function');
}
for (const m of ['volume', 'mute', 'stop', 'unload', 'codecs', 'pos', 'orientation', 'stereo']) {
    check(`Howler.${m}()`, typeof Howler[m] === 'function');
}

// ── 3. Format map matches Howler's codec table ────────────────────────
// Howler.codecs() is built from canPlayType() and is therefore empty in
// Node, so compare against the static table in the source instead.
const src = readFileSync(new URL('./modules/howler.js', import.meta.url), 'utf8');
// There are two `self._codecs` sites: an empty initialiser in the
// constructor and the populated table built from canPlayType(). Take the
// last one.
const start = src.lastIndexOf('self._codecs = {');
check('found the populated _codecs table in howler.js', start !== -1);
const codecsBlock = src.slice(start, src.indexOf('};', start));
const known = new Set([...codecsBlock.matchAll(/^\s+(\w+):/gm)].map(m => m[1]));
known.delete('self');
check('parsed Howler codec table', known.size > 5, [...known].join(','));

const audioSrc = readFileSync(new URL('./audio.js', import.meta.url), 'utf8');
const formats = new Set(
    [...audioSrc.matchAll(/format:\s*'(\w+)'/g)].map(m => m[1])
);
check('parsed audio.js format map', formats.size > 0, [...formats].join(','));
const unknown = [...formats].filter(f => !known.has(f));
check('every audio.js format is a known Howler codec', unknown.length === 0, unknown.join(', '));

// ── 4. The blob-URL hazard this migration had to solve ────────────────
// A blob: URL has no file extension, so without an explicit `format` Howler
// cannot pick a codec. Confirm the extension-sniffing path really is a dead
// end for blob URLs (i.e. that `format` is mandatory, not merely tidy).
const blobish = /^blob:/;
const stripped = 'blob:http://localhost:8080/6f1a-4c2e'.split('?')[0];
const sniffed = /\.([^.]+)$/.exec(stripped);
check('blob: URL has no sniffable extension', blobish.test(stripped) && sniffed === null,
    sniffed ? sniffed[0] : 'no match');

console.log(`\n${failed === 0 ? 'all checks passed' : failed + ' check(s) failed'}`);
process.exit(failed ? 1 : 0);
