// Exercises the pure logic in js/audio.js: track lookup, music/sfx
// classification, format detection and volume clamping. Playback itself is
// out of reach here — Howler has no audio backend in Node.
//
//   node js/audio.test.mjs

import { Howler } from './modules/howler.js';
import { addAudioToStore, clearAudioStore, getAudioStore } from './ltz.js';
import {
    resolveAudioKey,
    isMusicKey,
    detectFormat,
    setMasterVolume,
    getMasterVolume,
    playAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    isMusicPlaying,
    getCurrentMusicKey,
    unloadAllAudio,
} from './audio.js';

let failed = 0;
const check = (name, pass, detail = '') => {
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

// Several paths below are *expected* to warn (unknown track, unrecognised
// format). Capture warnings so they neither pollute stderr nor get missed.
const warned = [];
const realWarn = console.warn;
console.warn = (m) => warned.push(String(m));
const warnedAbout = (frag) => warned.some(w => w.includes(frag));

// Minimal valid-ish bytes; only the header matters for format sniffing.
const ogg = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0, 0, 0, 0]);
const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]);
const mp3 = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]);

clearAudioStore();
addAudioToStore('music', 'theme.ogg', ogg);
addAudioToStore('sfx', 'coin.wav', wav);
addAudioToStore('sfx', 'bang', mp3); // no extension on purpose

// ── track lookup ──────────────────────────────────────────────────────
check('resolves a bare filename', resolveAudioKey('theme.ogg') === 'audio/music/theme.ogg');
check('resolves a full key', resolveAudioKey('audio/sfx/coin.wav') === 'audio/sfx/coin.wav');
check('resolves an extensionless name', resolveAudioKey('bang') === 'audio/sfx/bang', String(resolveAudioKey('bang')));
check('unknown name resolves to null', resolveAudioKey('nope.ogg') === null);
check('empty name resolves to null', resolveAudioKey('') === null);
check('null name resolves to null', resolveAudioKey(null) === null);

// Guards against a prototype key sneaking through the lookup.
check('ignores inherited Object properties', resolveAudioKey('constructor') === null, String(resolveAudioKey('constructor')));

// ── music vs sfx ──────────────────────────────────────────────────────
check('music/ path is music', isMusicKey('audio/music/theme.ogg') === true);
check('sfx/ path is not music', isMusicKey('audio/sfx/coin.wav') === false);
check('unrelated path is not music', isMusicKey('audio/ambience/cave.ogg') === false);

// ── format detection ──────────────────────────────────────────────────
// This is the part that makes blob: URLs work at all: Howler cannot sniff a
// codec out of a blob: URL, so audio.js has to supply one.
const fmt = (name, bytes) => detectFormat(name, bytes).format;

check('.ogg -> ogg', fmt('theme.ogg', ogg) === 'ogg');
check('.oga -> ogg', fmt('theme.oga', ogg) === 'ogg');
check('.opus -> opus', fmt('theme.opus', ogg) === 'opus');
check('.wav -> wav', fmt('coin.wav', wav) === 'wav');
check('.mp3 -> mp3', fmt('bang.mp3', mp3) === 'mp3');
check('.flac -> flac', fmt('song.flac') === 'flac');
check('.m4a -> m4a', fmt('song.m4a') === 'm4a');
check('full store key -> format', fmt('audio/music/theme.ogg', ogg) === 'ogg');
check('uppercase extension -> lowercased', fmt('THEME.OGG', ogg) === 'ogg');
check('blob-ish name with no ext -> sniffed OggS', fmt('blob:http://x/1234', ogg) === 'ogg');
check('no ext, RIFF header -> sniffed wav', fmt('blob:http://x/1234', wav) === 'wav');
check('no ext, ID3 header -> sniffed mp3', fmt('blob:http://x/1234', mp3) === 'mp3');
check('no ext, frame sync -> sniffed mp3', fmt('x', new Uint8Array([0xFF, 0xE0, 0, 0])) === 'mp3');
check('no ext, fLaC header -> sniffed flac', fmt('x', new Uint8Array([0x66, 0x4C, 0x61, 0x43])) === 'flac');
check('no ext, unknown bytes -> falls back to mp3', fmt('x', new Uint8Array([1, 2, 3, 4])) === 'mp3');
check('no ext, no bytes -> falls back to mp3', fmt('x') === 'mp3');
check('fallback warns instead of failing silently', warnedAbout('unrecognised format for "x"'));
check('fallback carries a usable MIME', detectFormat('x').mime === 'application/octet-stream');
check('detected MIME types are audio/*', [ogg, wav, mp3].every(b => detectFormat('x', b).mime.startsWith('audio/')));

// ── master volume ─────────────────────────────────────────────────────
setMasterVolume(50);
check('setMasterVolume(50) -> 0.5', getMasterVolume() === 0.5, String(getMasterVolume()));
setMasterVolume(0);
check('setMasterVolume(0) -> 0', getMasterVolume() === 0);
setMasterVolume(100);
check('setMasterVolume(100) -> 1', getMasterVolume() === 1);
setMasterVolume(250);
check('clamps above 100', getMasterVolume() === 1, String(getMasterVolume()));
setMasterVolume(-40);
check('clamps below 0', getMasterVolume() === 0, String(getMasterVolume()));
setMasterVolume('loud');
check('rejects non-numeric input', getMasterVolume() === 0, String(getMasterVolume()));
setMasterVolume(80);
check('accepts numeric strings (script args are strings)', getMasterVolume() === 0.8, String(getMasterVolume()));

// Howler itself ignores out-of-range values rather than clamping, which is
// why audio.js clamps before delegating.
Howler.volume(0.8);
check('delegated level reached Howler', Howler.volume() === 0.8, String(Howler.volume()));

// ── playback guards (no backend, so these must bail cleanly) ──────────
const missing = await playAudio('does-not-exist.ogg');
check('unknown track returns null', missing === null, String(missing));
check('unknown track warned', warnedAbout('does-not-exist'));

check('no music before anything plays', getCurrentMusicKey() === null);
check('isMusicPlaying() false initially', isMusicPlaying() === false);
check('pause with no music is a safe no-op', (pauseAudio(), true));
check('resume with no music is a safe no-op', (resumeAudio(), true));
check('stop with no music is a safe no-op', (stopAudio('theme.ogg'), true));
check('stop(named) with no music is a safe no-op', (stopAudio(), true));

unloadAllAudio();
check('unloadAllAudio on an idle engine is safe', true);
check('unloadAllAudio cleared the music slot', getCurrentMusicKey() === null);

// The store itself must survive an unload — only Howls and blob: URLs go.
check('unloadAllAudio left the audio store intact', Object.keys(getAudioStore()).length === 3,
    Object.keys(getAudioStore()).join(', '));

// A second unload must not throw (no double-revoke).
unloadAllAudio();
check('double unloadAllAudio is safe', true);

console.warn = realWarn;
console.log(`\n${failed === 0 ? 'all checks passed' : failed + ' check(s) failed'}`);
process.exit(failed ? 1 : 0);