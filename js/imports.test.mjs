// Static check that every named import in js/ resolves to a real export.
// A missing binding is a hard SyntaxError at module load in the browser,
// which the Node-based unit tests cannot catch because they only import
// audio.js and ltz.js directly.
//
//   node js/imports.test.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

let failed = 0;
const check = (name, pass, detail = '') => {
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

/** Collect exported names from a module's source (handles the forms in use). */
function exportsOf(src) {
    const names = new Set();
    // export const/let/var/function/async function/class NAME
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) {
        names.add(m[1]);
    }
    // export { a, b as c }
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
        for (const part of m[1].split(',')) {
            const t = part.trim();
            if (!t) continue;
            const as = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(t);
            names.add(as ? as[1] : t);
        }
    }
    return names;
}

const files = ['player.js', 'audio.js', 'main.js', 'file.js', 'ltz.js', 'object-functions.js', 'sprite.js', 'sprite-sheet.js'];
const exportCache = new Map();
const exportsFor = (file) => {
    if (!exportCache.has(file)) {
        exportCache.set(file, exportsOf(readFileSync(resolvePath(here, file), 'utf8')));
    }
    return exportCache.get(file);
};

let total = 0;
for (const file of files) {
    const src = readFileSync(resolvePath(here, file), 'utf8');
    const specs = [...src.matchAll(/import\s+([^'"]*?)\s*from\s*['"](\.[^'"]+)['"]/g)];

    for (const [, clause, spec] of specs) {
        const target = resolvePath(here, dirname(file), spec);
        const rel = spec.replace(/^\.\//, '');

        if (!existsSync(target)) {
            check(`${file} -> ${rel} (file exists)`, false, 'missing');
            continue;
        }

        // `import * as ns from` has no named bindings to check.
        const nsOnly = /^\*\s*as\s+[A-Za-z_$][\w$]*$/.test(clause.trim());
        if (nsOnly) {
            check(`${file} -> ${rel} (namespace import)`, true);
            continue;
        }

        // Default-only imports (no braces) carry nothing to verify.
        const braces = /\{([\s\S]*)\}/.exec(clause);
        if (!braces) {
            check(`${file} -> ${rel} (side-effect/default import)`, true);
            continue;
        }

        const wanted = braces[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        const have = exportsFor(rel);

        for (const w of wanted) {
            total++;
            check(`${file}: '${w}' exported by ${rel}`, have.has(w),
                have.has(w) ? '' : `available: ${[...have].join(', ')}`);
        }
    }
}

console.log(`\n${total} named imports checked across ${files.length} modules`);
console.log(failed === 0 ? 'all checks passed' : `${failed} check(s) failed`);
process.exit(failed ? 1 : 0);
