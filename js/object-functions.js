//if (object === 'bullet' && tileType === 'object' && object.origin === 'object') return true; 

export let worldSaveData = { // Global game data
    spritesheet: [],
    boards: [],
    world: {},
    worldSettings: {
        startingStats: {
            health: 100,
            ammo: 10,
            coins: 0,
        },
        deathBoard: 2,
        globalScripts: "",
    },
    boardSettings: {
        1: {
            playerStart: { x: 10, y: 5, layer: 2 },
            reenterAtStart: true,
            linkedBoards: { east: 2, west: null, north: null, south: null },
            dark: false,
            nightmode: false,
            playerLocked: false,
            playerCanAttack: true,
            boardScript: "",
        },
        2: {
            playerStart: { x: 20, y: 10, layer: 2 },
            reenterAtStart: false,
            linkedBoards: { east: null, west: 1, north: null, south: null },
            dark: true,
            nightmode: false,
            playerLocked: false,
            playerCanAttack: true,
            boardScript: "",
        }
    }
};

export const defaultStatusMessageStyle = {
    color: "#fff",
    bgColor: "rgba(0,0,0,0.7)",
    x: null,
    y: null,
    font: "bold 16px 'Fira Code', monospace",
    letterSpacing: 2,
    shadow: false,
    duration: 4000
};

// Global mixin storage
export const scriptMixins = {}; // <-- Added for mixin support

// Words that cannot be used as flag names in #set.
// They conflict with #if syntax keywords, special value prefixes, or game terms.
export const RESERVED_FLAG_WORDS = new Set([
    // #if syntax keywords
    'then', 'not', 'and', 'or',
    // Special value prefixes (symbols already block these, but list for clarity)
    'rnd', 'true', 'false',
    // Game / world terms
    'nightmode', 'player',
    // Direction modifiers used in movement commands
    'opp', 'seek', 'flow', 'rndany', 'random',
    // Quantity keywords used in #take
    'all', 'half',
]);

// Commands that should halt further script processing for the current tick
const BLOCKING_COMMANDS = [
    'wait', 'sleep', 'end', 'cycle',
    'move', 'moveto', 'step', 'push', 'try',
    'change', 'changesprite', 'changecolor', 'color',
    'text', 'die', 'shoot'
];

export function loadObjectsFromGameData(gameData) {
    let placedObjects = {}; // Reset objects
    const placedSprites = gameData;
    let objectIdCounter = 1; // Initialize object ID counter

    for (let key in placedSprites) {
        let tile = placedSprites[key];

        // Extract layer, x, y from key
        let [layer, x, y] = key.split(",").map(Number);

        if (tile.type === "object" && tile.data.script) {
            placedObjects[key] = {
                id: `object-${objectIdCounter++}`, // Unique identifier
                layer,
                x,
                y,
                width: 32,
                height: 32,
                sprite: tile.sprite,
                color: tile.color, // Objects color. This can be changed
                defaultColor: tile.color, // Store default color. Can't be changed
                type: 'object',
                name: tile.data.name || "",
                direction: 'down', // Default direction
                statusMessageStyle: { ...defaultStatusMessageStyle }, // Default status message style
                waiting: false, // Initialize waiting state
                waitTime: 0, // Initialize wait time
                //speed: tile.data.speed || 1,  // Default to speed 1 NOT BEING USED
                timer: tile.data.timer || 0,  // Initialize timer NOT SURE IT'S USED
                timeSinceLastMove: 0, // Time since last move
                moveInterval: tile.data.moveInterval || 100, // Default move interval
                script: {}, // Parse script
                scriptIndex: 0,
                labels: {},  // Will store labels (e.g., `:touch`)
                zappedLabels: {},
                resting: false,
                pendingRemoval: false, // Flag for removal
            };

            // Parse labels for quick jumps
            const parsedScript = parseScript(tile.data.script);
            placedObjects[key].script = parsedScript.script;  // Store only the script array
            placedObjects[key].labels = parsedScript.labels;  // Store the labels separately

            // Pre-pass: set name from first @ (type: 'name') command in script, if present
            let foundName = "";
            for (let cmd of parsedScript.script) {
                if (cmd.type === "name" && typeof cmd.value === "string" && cmd.value.length > 0) {
                    foundName = cmd.value;
                    break;
                }
            }
            placedObjects[key].name = foundName;

            placedSprites[key].id = placedObjects[key].id; // Add ID to the sprite data too

            console.log(placedObjects[key].script);
        }
    }
    return placedObjects;
}

// Splits a command line into tokens, treating "quoted strings" as a single token.
function tokenizeCommand(str) {
    const tokens = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(str)) !== null) {
        tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    }
    return tokens;
}

function parseScript(text) {
    let lines = text.trim().split("\n").map(line => line.trim());
    let script = [];
    let labels = {};
    let index = 0;

    // --- MIXIN SUPPORT ---
    let inMixin = false;
    let currentMixinName = "";
    let currentMixinCommands = [];
    // --- END MIXIN SUPPORT ---

    while (index < lines.length) {
        let line = lines[index];
        if (line === "") { index++; continue; }

        // --- MIXIN DECLARATION ---
        if (line.startsWith("@mixin ")) {
            inMixin = true;
            currentMixinName = line.slice(7).trim();
            currentMixinCommands = [];
            index++;
            continue;
        }
        if (line.startsWith("@endmixin")) {
            if (inMixin && currentMixinName) {
                scriptMixins[currentMixinName] = currentMixinCommands.slice();
            }
            inMixin = false;
            currentMixinName = "";
            currentMixinCommands = [];
            index++;
            continue;
        }
        if (inMixin) {
            // --- MIXIN: Support #commands, *status, and text blocks ---
            if (line.startsWith("#")) {
                const [cmd, ...args] = tokenizeCommand(line.slice(1));
                const blocking = BLOCKING_COMMANDS.includes(cmd.toLowerCase());
                currentMixinCommands.push({ type: "command", name: cmd.toLowerCase(), args, blocking });
            } else if (line.startsWith("*")) {
                currentMixinCommands.push({ type: "status", text: line.slice(1).trim() });
            } else if (line !== "") {
                // Group consecutive text lines into one block (same as main parser)
                let textBlock = line;
                while (
                    index + 1 < lines.length &&
                    lines[index + 1] !== "" &&
                    !lines[index + 1].startsWith("#") &&
                    !lines[index + 1].startsWith(":") &&
                    !lines[index + 1].startsWith("@") &&
                    !lines[index + 1].startsWith("*") &&
                    !lines[index + 1].startsWith("--") &&
                    !lines[index + 1].startsWith("$") &&
                    !lines[index + 1].startsWith("!") &&
                    !lines[index + 1].startsWith("@endmixin")
                ) {
                    textBlock += "\n" + lines[index + 1];
                    index++;
                }
                currentMixinCommands.push({ type: "text", text: textBlock, blocking: true });
            }
            index++;
            continue;
        }
        // --- END MIXIN DECLARATION ---

        // ...existing code below...
        // Labels
        if (line.startsWith(":")) {
            // Prevent forbidden label names
            const forbiddenLabels = [":any"];
            if (forbiddenLabels.includes(line.toLowerCase())) {
                console.warn(`Label name "${line}" is reserved and cannot be used.`);
                index++;
                continue;
            }
            if (!labels[line]) labels[line] = [];
            labels[line].push(script.length);
            index++;
            continue;
        }

        // Comments
        if (line.startsWith("--") || line.startsWith("$") || line.startsWith("!")) {
            index++;
            continue;
        }

        // Object name
        if (line.startsWith("@")) {
            script.push({ type: "name", value: line.slice(1).trim() });
            index++;
            continue;
        }

        // Status message
        if (line.startsWith("*")) {
            script.push({ type: "status", text: line.slice(1).trim() });
            index++;
            continue;
        }

        // Commands
        if (line.startsWith("#")) {
            const [cmd, ...args] = tokenizeCommand(line.slice(1));
            const blocking = BLOCKING_COMMANDS.includes(cmd.toLowerCase());
            script.push({ type: "command", name: cmd.toLowerCase(), args, blocking });
            index++;
            continue;
        }

        // Slash commands (e.g. /e/e/n/i)
        if (line.startsWith("/")) {
            // Remove leading slash, split by '/', filter out empty
            let moves = line.split('/').filter(Boolean);
            for (let move of moves) {
                // Lowercase is normal move, uppercase is step
                if (move.length === 1) {
                    if (move === 'i') {
                        script.push({ type: "command", name: "sleep", args: ["1"], blocking: true });
                    } else if (move === 'I') {
                        script.push({ type: "command", name: "sleep", args: ["1"], blocking: true });
                    } else if (move === move.toUpperCase()) {
                        // Capital letter: step + move
                        script.push({ type: "command", name: "step", args: [] });
                        script.push({ type: "command", name: "move", args: [move.toLowerCase()], blocking: true });
                    } else {
                        // Lowercase: normal move
                        script.push({ type: "command", name: "move", args: [move], blocking: true });
                    }
                }
                // You can expand this for multi-char commands if needed
            }
            index++;
            continue;
        }

        // Group consecutive text lines into one block
        if (line !== "") {
            let textBlock = line;
            while (
                index + 1 < lines.length &&
                lines[index + 1] !== "" &&
                !lines[index + 1].startsWith("#") &&
                !lines[index + 1].startsWith(":") &&
                !lines[index + 1].startsWith("@") &&
                !lines[index + 1].startsWith("*") &&
                !lines[index + 1].startsWith("--") &&
                !lines[index + 1].startsWith("$") &&
                !lines[index + 1].startsWith("!") &&
                !lines[index + 1].startsWith("/")
            ) {
                textBlock += "\n" + lines[index + 1];
                index++;
            }
            //script.push({ type: "text", text: textBlock });
            script.push({ type: "text", text: textBlock, blocking: true }); // Mark as blocking
            index++;
            continue;
        }
    }

    return { script, labels };
}

export function resolveLabel(obj, label) {
    const locations = obj.labels[label];
    const zapped = obj.zappedLabels?.[label] || 0;

    // If locations is undefined or all zapped, return null
    if (!locations || locations.length <= zapped) return null;
    return locations[zapped];
}

export function adjustStat(player, item, amount) {
    if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
        console.error("Invalid amount to adjust.");
        return;
    }

    if (!player.stats.hasOwnProperty(item)) {
        console.error("Invalid stat type:", item);
        return;
    }

    player.stats[item] += amount;

    // Prevent stat from going below 0
    if (player.stats[item] < 0) player.stats[item] = 0;

    // Optionally log the update
    // console.log(`Adjusted ${item}: ${player.stats[item]}`);
}

// Helper function to extract RGB values
export function extractRGB(str) {
    let match = str.match(/\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+(\.\d+)?)?\)/); // Capture RGB, ignore alpha
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 1] : [0, 0, 0, 1]; // Default to black with full alpha
}

// Named color lookup table
export const namedColors = {
    "red": [255, 0, 0, 255],
    "pink": [255, 182, 193, 255],
    "blue": [0, 0, 255, 255],
    "green": [0, 255, 0, 255],
    "yellow": [255, 255, 0, 255],
    "purple": [128, 0, 128, 255],
    "orange": [255, 165, 0, 255],
    "white": [255, 255, 255, 255],
    "black": [0, 0, 0, 255]
};

export function convertDirections(direction) {
    const dir = direction.toLowerCase(); // Normalize to lowercase 
    switch (dir) {
        case 'up':
        case 'north':
        case 'n':
            return 'up';
        case 'right':
        case 'east':
        case 'e':
            return 'right';
        case 'down':
        case 'south':
        case 's':
            return 'down';
        case 'left':
        case 'west':
        case 'w':
            return 'left';
        default:
            return -1; // Invalid direction
    }
}

export function calculateSeekDirection(obj, player) {
    const dx = player.x - obj.x; // Difference in x-coordinates
    const dy = player.y - obj.y; // Difference in y-coordinates

    // Determine the primary direction based on the larger absolute difference
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'right' : 'left'; // Move horizontally
    } else {
        return dy > 0 ? 'down' : 'up'; // Move vertically
    }
}

export function calculateBulletPosition(x, y, direction) {
    switch (direction) {
        case 'up':
            return { x: x + 0.5, y: y - 0.5 };
        case 'down':
            return { x: x + 0.5, y: y + 1 };
        case 'right':
            return { x: x + 1, y: y + 0.5 };
        case 'left':
            return { x: x - 0.5, y: y + 0.5 };
        default:
            console.warn(`Invalid bullet direction: ${direction}`);
            return { x, y }; // Return the original position if the direction is invalid
    }
}

export const messageStylePresets = {
    alert: { color: "#fff", bgColor: "#c00", duration: 3000, font: "bold 18px monospace" },
    info: { color: "#222", bgColor: "#eee", duration: 2000, font: "16px monospace" },
    centered: { x: null, y: null, font: "bold 20px monospace" },
    warning: { color: "#ff0", bgColor: "#333", duration: 4000, font: "bold 18px monospace" },
    success: { color: "#fff", bgColor: "#080", duration: 2500, font: "bold 18px monospace" },
    error: { color: "#fff", bgColor: "#900", duration: 3500, font: "bold 18px monospace" },
    tip: { color: "#333", bgColor: "#ff9", duration: 2200, font: "italic 16px monospace" },
    subtle: { color: "#888", bgColor: "#222", duration: 1800, font: "16px monospace" },
    big: { color: "#fff", bgColor: "#000", duration: 4000, font: "bold 32px monospace" }
};

// =============================================
// ############ #if Condition Engine ###########
// =============================================

// Joins raw command args back into a single string and re-tokenizes it,
// properly handling quoted strings (e.g. "john smith" becomes one token).
function retokenizeIfArgs(args) {
    const raw = args.join(' ');
    const tokens = [];
    let i = 0;
    while (i < raw.length) {
        if (raw[i] === ' ') { i++; continue; }
        if (raw[i] === '"') {
            // Quoted string — collect until closing quote, strip the quotes
            let j = i + 1;
            while (j < raw.length && raw[j] !== '"') j++;
            tokens.push(raw.slice(i + 1, j));
            i = j + 1;
            continue;
        }
        // Regular token — collect until next space
        let j = i;
        while (j < raw.length && raw[j] !== ' ') j++;
        tokens.push(raw.slice(i, j));
        i = j;
    }
    return tokens;
}

// Resolves a single token to a concrete value.
export function resolveNumericArg(token) {
    if (typeof token === 'number') return token;
    if (token === undefined || token === null) return NaN;
    const str = String(token).trim();
    if (str === '') return NaN;

    const rndMatch = str.match(/^rnd\s*\(\s*(-?\d+)\s*(?:,\s*(-?\d+)\s*|to\s+(-?\d+)\s*)?\)$/i);
    if (rndMatch) {
        const a = parseInt(rndMatch[1], 10);
        const b = rndMatch[2] !== undefined && rndMatch[2] !== undefined ? parseInt(rndMatch[2], 10)
                : rndMatch[3] !== undefined ? parseInt(rndMatch[3], 10)
                : null;
        if (b === null) {
            return Math.floor(Math.random() * (a + 1));
        }
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const n = Number(str);
    return isNaN(n) ? NaN : n;
}

// Handles: $var, p.stat, rnd(n), rnd(n,m), numeric literals, plain strings.
function resolveSingleValue(token, player, scriptGlobals) {
    if (token === undefined || token === null) return '';
    const s = String(token);

    // $variable → scriptGlobals lookup
    if (s.startsWith('$')) {
        const val = scriptGlobals[s];
        return val !== undefined ? val : '';
    }

    // p.stat → player stat lookup (checks player.stats first, then player directly)
    if (s.startsWith('p.')) {
        const statName = s.slice(2);
        if (player.stats && player.stats[statName] !== undefined) return player.stats[statName];
        if (player[statName] !== undefined) return player[statName];
        return 0;
    }

    // rnd(n) → random integer 0..n   |   rnd(n,m) → random integer n..m
    const rndMatch = s.match(/^rnd\((\d+)(?:,(\d+))?\)$/i);
    if (rndMatch) {
        const a = parseInt(rndMatch[1], 10);
        const b = rndMatch[2] !== undefined ? parseInt(rndMatch[2], 10) : null;
        return b === null
            ? Math.floor(Math.random() * (a + 1))
            : Math.floor(Math.random() * (b - a + 1)) + a;
    }

    // Numeric literal
    if (s.trim() !== '' && !isNaN(s)) return Number(s);

    // Plain string
    return s;
}

// Evaluates a sequence of tokens as a left-to-right arithmetic / string expression.
// Arithmetic operators: + - * /
// Strings: + concatenates; other operators on strings produce a warning.
function evalExpression(tokens, player, scriptGlobals) {
    if (!tokens.length) return '';
    const MATH_OPS = ['+', '-', '*', '/'];

    let result = resolveSingleValue(tokens[0], player, scriptGlobals);

    let i = 1;
    while (i < tokens.length) {
        const opToken = tokens[i];
        if (!MATH_OPS.includes(opToken) || i + 1 >= tokens.length) {
            // Not a recognised operator — treat remaining token as string concat
            result = String(result) + String(resolveSingleValue(tokens[i], player, scriptGlobals));
            i++;
            continue;
        }
        const nextVal = resolveSingleValue(tokens[i + 1], player, scriptGlobals);
        const lNum = Number(result);
        const rNum = Number(nextVal);
        if (!isNaN(lNum) && !isNaN(rNum)) {
            switch (opToken) {
                case '+': result = lNum + rNum; break;
                case '-': result = lNum - rNum; break;
                case '*': result = lNum * rNum; break;
                case '/': result = rNum !== 0 ? lNum / rNum : 0; break;
            }
        } else {
            // Non-numeric: only + (concat) makes sense
            if (opToken === '+') {
                result = String(result) + String(nextVal);
            } else {
                console.warn(`#if evalExpression: Cannot apply '${opToken}' to non-numeric values`);
                result = String(result);
            }
        }
        i += 2;
    }
    return result;
}

// Compares two resolved values with the given operator.
// Prefers numeric comparison when both sides parse as numbers.
function compareValues(lhs, rhs, op) {
    const lNum = Number(lhs);
    const rNum = Number(rhs);
    const bothNumeric = !isNaN(lNum) && !isNaN(rNum)
        && String(lhs).trim() !== '' && String(rhs).trim() !== '';
    const a = bothNumeric ? lNum : String(lhs);
    const b = bothNumeric ? rNum : String(rhs);
    switch (op) {
        case '=':  case '==': return a == b;
        case '!=': case '<>': return a != b;
        case '<':  return a < b;
        case '>':  return a > b;
        case '<=': return a <= b;
        case '>=': return a >= b;
        default: return false;
    }
}

/**
 * Evaluates a full #if condition from raw command args.
 *
 * Syntax:
 *   #if <flag>                    then :label          ← flag truthy check (backwards-compatible)
 *   #if $var                      then :label          ← variable truthy check
 *   #if $num = 3                  then :label
 *   #if $num + 5 >= 10            then :dosomething
 *   #if $a + $b + $c = 20         then :explode
 *   #if rnd(8) = 4                then :label          ← random 0–8
 *   #if rnd(3,8) = 5              then :funlabel       ← random 3–8
 *   #if p.ammo < 1                then :warning        ← player stat
 *   #if $first + $last = "john smith" then #die        ← inline command action
 *
 * Returns { conditionMet: bool, action: { type, value?, name?, args? } } or null on error.
 */
export function evaluateIfCondition(args, player, scriptGlobals, scriptFlags) {
    const tokens = retokenizeIfArgs(args);
    const thenIdx = tokens.findIndex(t => t.toLowerCase() === 'then');

    if (thenIdx === -1) {
        console.warn("#if: missing 'then' keyword. Usage: #if <condition> then <:label|#command>");
        return null;
    }

    const condTokens = tokens.slice(0, thenIdx);
    const actionTokens = tokens.slice(thenIdx + 1);

    if (!condTokens.length) { console.warn("#if: empty condition before 'then'."); return null; }
    if (!actionTokens.length) { console.warn("#if: missing action after 'then'."); return null; }

    // Parse action: :label  OR  #command [args...]
    const actionStr = actionTokens[0];
    let action;
    if (actionStr.startsWith(':')) {
        action = { type: 'label', value: actionStr };
    } else if (actionStr.startsWith('#')) {
        action = { type: 'command', name: actionStr.slice(1).toLowerCase(), args: actionTokens.slice(1) };
    } else {
        console.warn(`#if: action must start with ':' (label) or '#' (command), got: "${actionStr}"`);
        return null;
    }

    // Find comparison operator — multi-char ops checked first to avoid partial matches
    const COMPARE_OPS = ['<=', '>=', '<>', '!=', '==', '<', '>', '='];
    let opIdx = -1;
    let op = null;
    for (const candidate of COMPARE_OPS) {
        const idx = condTokens.indexOf(candidate);
        if (idx !== -1) { opIdx = idx; op = candidate; break; }
    }

    let conditionMet;

    if (opIdx === -1) {
        // No comparison operator → single-value truthy check.
        // Priority: $variable → p.stat → rnd() → flag
        // This prevents a flag named e.g. "p.ammo" from shadowing the real stat.
        const single = condTokens[0];
        if (single && single.startsWith('$')) {
            // $variable truthy check
            const val = scriptGlobals[single];
            conditionMet = val !== undefined && val !== '' && val !== '0' && val !== 'false';
        } else if (single && single.startsWith('p.')) {
            // Player stat truthy check: #if p.ammo then :label
            const resolved = resolveSingleValue(single, player, scriptGlobals);
            conditionMet = resolved !== 0 && resolved !== '' && resolved !== false && resolved !== '0';
        } else if (single && /^rnd\(/i.test(single)) {
            // rnd() truthy check (edge case: #if rnd(5) then :label — true when result !== 0)
            const resolved = resolveSingleValue(single, player, scriptGlobals);
            conditionMet = resolved !== 0;
        } else {
            // Plain flag lookup
            const flagKey = (single || '').toLowerCase();
            conditionMet = Object.prototype.hasOwnProperty.call(scriptFlags, flagKey) && !!scriptFlags[flagKey];
        }
    } else {
        const lhs = evalExpression(condTokens.slice(0, opIdx), player, scriptGlobals);
        const rhs = evalExpression(condTokens.slice(opIdx + 1), player, scriptGlobals);
        conditionMet = compareValues(lhs, rhs, op);
    }

    return { conditionMet, action };
}