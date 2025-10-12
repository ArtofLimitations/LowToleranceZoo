//if (object === 'bullet' && tileType === 'object' && object.origin === 'object') return true; 


// Global mixin storage
export const scriptMixins = {}; // <-- Added for mixin support

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
                const [cmd, ...args] = line.slice(1).split(" ");
                const blocking = ["wait", "sleep", "end", "cycle", "move", "moveto", "moveTo", "change", "changeSprite", "changesprite", "changeColor", "changecolor", "color", "text", "die", "shoot"].includes(cmd.toLowerCase());
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
            const [cmd, ...args] = line.slice(1).split(" ");
            const blocking = ["wait", "sleep", "end", "cycle", "move", "moveto", "moveTo", "change", "changeSprite", "changesprite", "changeColor", "changecolor", "color", "text", "die", "shoot"].includes(cmd.toLowerCase());
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
                !lines[index + 1].startsWith("!")
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