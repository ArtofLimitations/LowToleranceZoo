//if (object === 'bullet' && tileType === 'object' && object.origin === 'object') return true; 

// Find all objects and create a new array PlacedObjects and parse

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
                color: tile.color,
                type: 'object',
                name: tile.data.name || "",
                direction: 'down', // Default direction
                waiting: false, // Initialize waiting state
                waitTime: 0, // Initialize wait time
                speed: tile.data.speed || 1,  // Default to speed 1
                timer: tile.data.timer || 0,  // Initialize timer
                timeSinceLastMove: 0, // Time since last move
                moveInterval: tile.data.moveInterval || 100, // Default move interval
                script: {}, // Parse script
                scriptIndex: 0,
                labels: {},  // Will store labels (e.g., `:touch`)
                zappedLabels: {},
                resting: false,
            };

            // Parse labels for quick jumps
            const parsedScript = parseScript(tile.data.script);
            placedObjects[key].script = parsedScript.script;  // Store only the script array
            placedObjects[key].labels = parsedScript.labels;  // Store the labels separately

            placedSprites[key].id = placedObjects[key].id; // Add ID to the sprite data too

            console.log(placedObjects[key].script);
        }
    }
    return placedObjects;
}

export function gridLoadObjectsFromGameData(gameData, grid) {
    for (let key in gameData) {
        const tile = gameData[key];
        const [layer, x, y] = key.split(',').map(Number);
        let id = 1;

        if (tile.type === 'object' && tile.data.script) {
            const object = {
                id: `object-${objectIdCounter++}`, // Unique identifier
                layer,
                x,
                y,
                width: 32,
                height: 32,
                sprite: tile.sprite,
                color: tile.color,
                type: 'object',
                name: tile.data.name || "",
                direction: 'down',
                waiting: false,
                waitTime: 0,
                speed: tile.data.speed || 1,
                timer: tile.data.timer || 0,
                timeSinceLastMove: 0,
                moveInterval: tile.data.moveInterval || 100,
                script: parseScript(tile.data.script).script,
                labels: parseScript(tile.data.script).labels,
                resting: false
            };

            addObjectToGrid(grid, object, x, y);
        }
    }
}

function parseScript(text) {
    let lines = text.trim().split("\n").map(line => line.trim());
    let script = [];
    let labels = {}; // Store label positions as arrays
    let collectingText = false;
    let textBlock = "";
    let index = 0;

    for (let line of lines) {
        if (line === "#text") {
            collectingText = true;
            textBlock = "";
            continue;
        }

        if (collectingText) {
            if (line.startsWith("#")) {
                script.push(`#text ${textBlock.trim()}`);
                script.push(line); // Next command
                collectingText = false;
                index += 2;
            } else {
                textBlock += line + "\n";
            }
            continue;
        }

        if (line.startsWith(":")) {
            if (!labels[line]) {
                labels[line] = [];
            }
            labels[line].push(index); // Push the label position
            continue; // Labels aren't stored in the script array
        }

        if (line !== "") {
            script.push(line);
            index++;
        }
    }

    return { script, labels };
}

export function resolveLabel(obj, label) {
    const locations = obj.labels[label];
    const zapped = obj.zappedLabels?.[label] || 0;

    if (!locations || locations.length <= zapped) return null;
    return locations[zapped];
}

export function takeStat(player, item, amount) {
    if (amount <= 0) {
        console.error("Invalid amount to take.");
        return;
    }

    if (player.stats.hasOwnProperty(item)) {
        if (player.stats[item] > 0) player.stats[item] -= amount;
        if (player.stats[item] < 0) player.stats[item] === 0;
    } else {
        console.error("Invalid item type:", item);
    }
}

export function giveStat(player, item, amount) {
    if (amount <= 0) {
        console.error("Invalid amount to give.");
        return;
    }

    if (player.stats.hasOwnProperty(item)) {
        player.stats[item] += amount; // Increment the stat
        console.log(`Updated ${item}: ${player.stats[item]}`);
    } else {
        console.error(`Invalid stat type: ${item}`);
    }
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