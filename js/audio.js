// audio.js — Howler-based audio playback for Low Tolerance Zoo.
// Init: js/player.js
//
// Track bytes live in the .ltz audio store (see ltz.js) as raw Uint8Arrays.
// Howler wants a URL, so each track gets a lazily-created blob: URL that is
// cached alongside its Howl and revoked when the project is unloaded.
//
// This is the ONLY module that talks to Howler. Everything else in the game
// goes through the exported play/stop/pause/volume functions below, so the
// playback backend can be swapped without touching the script interpreter.

import { Howl, Howler } from './modules/howler.js';
import { getAudioStore } from './ltz.js';

// Master volume, 0..1. Kept locally because the global Howler.volume()
// is not readable until an AudioContext exists.
let masterVolume = 1;

// key -> Howl   (one decoded instance per track, reused across plays)
const howls = {};
// key -> blob: URL (owned by us, must be revoked on unload)
const objectUrls = {};

// The single "music" track slot. Music is exclusive: only one plays at a time.
let currentMusic = null;      // Howl
let currentMusicKey = null;  // store key
let currentMusicId = null;   // Howl sound id of the playing instance
let musicPaused = false;

// Howler builds its AudioContext lazily and browsers suspend it until a user
// gesture. Until this has been set by a keydown/click, scripted music is
// silently dropped, so we kick the context awake on the first real input.
let audioUnlocked = false;

const MUSIC_PATH = /(^|\/)music\//;

/**
 * Extension -> { mime, format }.
 * `format` is howler's codec key (js/modules/howler.js `Howler.codecs`).
 * A Howl built from a blob: URL has no file extension for howler to sniff,
 * so this map — or the magic-byte fallback in detectFormat() — is required.
 */
const AUDIO_FORMATS = {
    ogg: { mime: 'audio/ogg', format: 'ogg' },
    oga: { mime: 'audio/ogg', format: 'ogg' },
    opus: { mime: 'audio/ogg', format: 'opus' },
    mp3: { mime: 'audio/mpeg', format: 'mp3' },
    wav: { mime: 'audio/wav', format: 'wav' },
    flac: { mime: 'audio/flac', format: 'flac' },
    m4a: { mime: 'audio/mp4', format: 'm4a' },
    mp4: { mime: 'audio/mp4', format: 'mp4' },
    aac: { mime: 'audio/aac', format: 'aac' },
    webm: { mime: 'audio/webm', format: 'webm' },
};

const DEFAULT_MIME = 'application/octet-stream';
const DEFAULT_FORMAT = 'mp3';

// How long to wait for the browser to unlock the AudioContext before giving up
// on a play() that would otherwise be dropped. See unlockAudio().
const UNLOCK_RETRY_MS = 300;

// ─────────────────────────────────────────────
// Format / MIME detection
// ─────────────────────────────────────────────

/**
 * Work out the MIME type and Howler codec key for a track.
 * Exported for tests; call sites should prefer getHowl()/playAudio().
 * @param {string} name   Filename or store key.
 * @param {Uint8Array} [bytes]  Used only to sniff when the name is unhelpful.
 * @returns {{mime: string, format: string}}
 */
export function detectFormat(name, bytes) {
    const ext = String(name || '').split('.').pop()?.toLowerCase();
    if (ext && AUDIO_FORMATS[ext]) return AUDIO_FORMATS[ext];

    // No usable extension (or an unknown one) — sniff the magic bytes.
    if (bytes && bytes.length >= 4) {
        const b = bytes;
        if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return AUDIO_FORMATS.ogg; // "OggS"
        if (b[0] === 0x66 && b[1] === 0x4C && b[2] === 0x61 && b[3] === 0x43) return AUDIO_FORMATS.flac; // "fLaC"
        if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return AUDIO_FORMATS.wav; // "RIFF"
        if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return AUDIO_FORMATS.mp3; // "ID3"
        if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return AUDIO_FORMATS.mp3; // MPEG frame sync
    }

    console.warn(`audio: unrecognised format for "${name}" — assuming ${DEFAULT_FORMAT}.`);
    return { mime: DEFAULT_MIME, format: DEFAULT_FORMAT };
}

// ─────────────────────────────────────────────
// Track lookup
// ─────────────────────────────────────────────

/** True when a store key lives under audio/music/ (i.e. is a music track). */
export function isMusicKey(key) {
    return MUSIC_PATH.test(key);
}

/**
 * Resolve a script-supplied name to a key in the audio store.
 * Tries an exact key first, then a filename-only match, so both
 * `#music theme` and `#music audio/music/theme.ogg` work.
 */
export function resolveAudioKey(trackName) {
    const store = getAudioStore();
    if (!trackName) return null;
    if (Object.prototype.hasOwnProperty.call(store, trackName)) return trackName;

    const suffix = '/' + trackName;
    return Object.keys(store).find(k => k.endsWith(suffix)) || null;
}

function getObjectUrl(key, bytes, name) {
    if (!objectUrls[key]) {
        const { mime } = detectFormat(name || key, bytes);
        objectUrls[key] = URL.createObjectURL(new Blob([bytes], { type: mime }));
    }
    return objectUrls[key];
}

/**
 * Get (or build) the cached Howl for a track key.
 * Returns null if the track is not in the store.
 */
function getHowl(key) {
    if (howls[key]) return howls[key];

    const store = getAudioStore();
    const bytes = store[key];
    if (!bytes) return null;

    const isMusic = isMusicKey(key);
    const { format } = detectFormat(key, bytes);
    const url = getObjectUrl(key, bytes, key);

    const howl = new Howl({
        src: [url],
        // Required: a blob: URL has no extension, so howler cannot sniff the
        // codec on its own and would emit 'No codec support for selected
        // audio sources' without this.
        format: [format],
        loop: false,
        volume: 1,
        // SFX overlap freely (several coins in one tick), music is exclusive.
        pool: isMusic ? 1 : 12,
        preload: true,
        onloaderror: (id, err) => {
            console.error(`audio: failed to decode "${key}"`, err);
        },
        onplayerror: (id, err) => {
            console.error(`audio: playback blocked for "${key}"`, err);
            // The common cause is a suspended context — try to wake it and replay.
            unlockAudio().then(unlocked => {
                if (unlocked) howl.play(id);
            });
        },
    });

    if (isMusic) {
        // Clear the music slot when a non-looping track finishes on its own.
        howl.once('end', () => {
            if (howl.loop()) return;
            if (currentMusicKey === key) clearMusicSlot();
        });
    }

    howls[key] = howl;
    return howl;
}

function clearMusicSlot() {
    currentMusic = null;
    currentMusicKey = null;
    currentMusicId = null;
    musicPaused = false;
}

// ─────────────────────────────────────────────
// Autoplay unlock
// ─────────────────────────────────────────────

/**
 * Resume the AudioContext if the browser suspended it.
 * Returns true when the context is running.
 */
export async function unlockAudio() {
    try {
        if (!Howler.ctx) return false;
        if (Howler.ctx.state === 'suspended') await Howler.ctx.resume();
        if (Howler.ctx.state === 'running') audioUnlocked = true;
        return Howler.ctx.state === 'running';
    } catch (err) {
        console.warn('audio: could not unlock the audio context', err);
        return false;
    }
}

/** True once a user gesture has allowed the AudioContext to run. */
export function isAudioUnlocked() {
    return audioUnlocked;
}

// ─────────────────────────────────────────────
// Playback
// ─────────────────────────────────────────────

function stopCurrentMusic({ fadeOut = 0 } = {}) {
    if (!currentMusic) return;

    const howl = currentMusic;
    const soundId = currentMusicId;
    clearMusicSlot();

    if (fadeOut > 0) {
        howl.once('fade', () => howl.stop(soundId), soundId);
        howl.fade(howl.volume(soundId), 0, fadeOut, soundId);
    } else {
        howl.stop(soundId);
    }
}

/**
 * Play a track from the audio store.
 *
 * @param {string} trackName  Key or bare filename, e.g. `theme` or `audio/music/theme.ogg`.
 * @param {object} [options]
 * @param {boolean} [options.loop=false]     Loop the track (music only).
 * @param {boolean} [options.stopCurrent=true] Stop whatever music is playing first.
 * @param {number}  [options.fadeIn=0]       Fade in over N ms.
 * @param {number}  [options.fadeOut=0]      Fade out the outgoing music over N ms.
 * @param {number}  [options.volume=1]       Track volume multiplier, 0..1.
 * @returns {Promise<number|null>} Howl sound id, or null if the track is unknown.
 */
export async function playAudio(trackName, {
    loop = false,
    stopCurrent = true,
    fadeIn = 0,
    fadeOut = 0,
    volume = 1,
} = {}) {
    const key = resolveAudioKey(trackName);
    if (!key) {
        console.warn(`audio: track "${trackName}" not found in the audio store.`);
        return null;
    }

    const isMusic = isMusicKey(key);
    const target = typeof volume === 'number' ? Math.min(Math.max(volume, 0), 1) : 1;

    // Re-requesting the music that is already playing is a no-op.
    if (isMusic && currentMusicKey === key && !musicPaused) {
        return currentMusicId;
    }

    if (isMusic) stopCurrentMusic({ fadeOut });

    const howl = getHowl(key);
    if (!howl) return null;

    // Browsers drop playback until a gesture unlocks the context. Wait briefly
    // for it rather than failing the first scripted track after page load.
    if (!audioUnlocked && !(await waitForUnlock())) {
        console.warn(`audio: "${trackName}" skipped — the browser has not unlocked audio yet.`);
        return null;
    }

    howl.loop(!!(loop && isMusic));
    howl.volume(target);
    const soundId = howl.play();
    if (soundId === undefined || soundId === null) return null;

    if (fadeIn > 0) {
        howl.fade(0, target, fadeIn, soundId);
    }

    if (isMusic) {
        currentMusic = howl;
        currentMusicKey = key;
        currentMusicId = soundId;
        musicPaused = false;
    }

    return soundId;
}

function waitForUnlock() {
    if (audioUnlocked) return Promise.resolve(true);
    return new Promise(resolve => {
        let waited = 0;
        const tick = () => {
            if (audioUnlocked || waited >= UNLOCK_RETRY_MS) {
                resolve(audioUnlocked);
                return;
            }
            waited += 50;
            setTimeout(tick, 50);
        };
        unlockAudio().then(ok => { if (ok) resolve(true); });
        tick();
    });
}

// ─────────────────────────────────────────────
// Stop / pause / volume
// ─────────────────────────────────────────────

/**
 * Stop music, or a specific track.
 * @param {string|null} [trackName]  Only stop if this is the track playing.
 * @param {object} [options]
 * @param {number} [options.fadeOut=0]  Fade out over N ms before stopping.
 */
export function stopAudio(trackName = null, { fadeOut = 0 } = {}) {
    if (trackName) {
        const key = resolveAudioKey(trackName);
        if (!key || key !== currentMusicKey) return; // not the current track
    }
    stopCurrentMusic({ fadeOut });
}

/** Stop every sound, music and SFX alike. */
export function stopAllAudio() {
    stopCurrentMusic();
    for (const key in howls) {
        try { howls[key].stop(); } catch (_) { /* already gone */ }
    }
}

/** Pause the current music track. */
export function pauseAudio() {
    if (!currentMusic || musicPaused) return;
    currentMusic.pause(currentMusicId);
    musicPaused = true;
}

/** Resume a paused music track. */
export function resumeAudio() {
    if (!currentMusic || !musicPaused) return;
    currentMusic.play(currentMusicId);
    musicPaused = false;
}

/** Toggle between paused and playing. */
export function togglePauseAudio() {
    if (musicPaused) resumeAudio();
    else pauseAudio();
}

/** True when music is loaded and playing. */
export function isMusicPlaying() {
    return !!currentMusic && !musicPaused;
}

/** The store key of the music track currently loaded, or null. */
export function getCurrentMusicKey() {
    return currentMusicKey;
}

// ─────────────────────────────────────────────
// Volume
// ─────────────────────────────────────────────

/**
 * Set the global output level.
 * @param {number} level  0..100 (script-friendly; clamped).
 * @returns {number} The applied level, 0..1.
 */
export function setMasterVolume(level) {
    const n = Number(level);
    if (!Number.isFinite(n)) return masterVolume;

    masterVolume = Math.min(Math.max(n, 0), 100) / 100;
    Howler.volume(masterVolume);
    return masterVolume;
}

/** Current global output level, 0..1. */
export function getMasterVolume() {
    return masterVolume;
}

/** Mute/unmute everything. Independent of the 0..100 level. */
export function setMuted(muted) {
    Howler.mute(!!muted);
}

// ─────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────

/**
 * Release every Howl and revoke every blob: URL.
 * Call this whenever a different project is loaded — otherwise the previous
 * project's audio stays in memory and can still be triggered.
 */
export function unloadAllAudio() {
    stopAllAudio();
    for (const key in howls) {
        try { howls[key].unload(); } catch (_) { /* already gone */ }
        delete howls[key];
    }
    for (const key in objectUrls) {
        URL.revokeObjectURL(objectUrls[key]);
        delete objectUrls[key];
    }
    clearMusicSlot();
    audioUnlocked = false;
}
