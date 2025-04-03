//if (object === 'bullet' && tileType === 'object' && object.origin === 'object') return true; 

// Find all objects and create a new array PlacedObjects and parse

export function loadObjectsFromGameData(gameData) {
    let placedObjects = {}; // Reset objects
    const placedSprites = gameData;

    for (let key in placedSprites) {
        let tile = placedSprites[key];

        // Extract layer, x, y from key
        let [layer, x, y] = key.split(",").map(Number);

        if (tile.type === "object" && tile.data.script) {
            placedObjects[key] = {
                layer,
                x,
                y,
                sprite: tile.sprite,
                color: tile.color,
                name: tile.data.name || "",
                direction: 'down', // Default direction
                waiting: false, // Initialize waiting state
                waitTime: 0, // Initialize wait time
                speed: tile.data.speed || 1,  // Default to speed 1
                timer: tile.data.timer || 0,  // Initialize timer
                timeSinceLastMove: 0, // Time since last move
                moveInterval: tile.data.moveInterval || 300, // Default move interval
                script: {}, // Parse script
                //script: parseScriptFromTextarea(tile.data.script), // Parse script
                scriptIndex: 0,
                labels: {},  // Will store labels (e.g., `:touch`)
                resting: false,
            };

            // Parse labels for quick jumps
            const parsedScript = parseScript(tile.data.script);
            placedObjects[key].script = parsedScript.script;  // Store only the script array
            placedObjects[key].labels = parsedScript.labels;  // Store the labels separately

            console.log(placedObjects[key].script);
        }
    }
    return placedObjects;
}

function parseScript(text) {
    let lines = text.trim().split("\n").map(line => line.trim());
    let script = [];
    let labels = {}; // Store label positions
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
                script.push(line); // Keep the command
                collectingText = false;
            } else {
                textBlock += line + "\n";
            }
            continue;
        }

        if (line.startsWith(":")) {
            labels[line] = index; // Store label position
            continue; // Don't store labels in the script array
        }

        if (line !== "") {
            script.push(line);
            index++;
        }
    }

    return { script, labels };
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