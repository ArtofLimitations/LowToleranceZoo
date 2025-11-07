import { loadCombinedData, loadWorld } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, drawPlayerSprite, drawSpriteImage, getSprite } from './sprite.js';
import { createBullet, deactivateAllBullets } from './weapons.js';
import { defaultPlayerStats } from './player-stats.js';
import { extractRGB, namedColors, loadObjectsFromGameData, resolveLabel, convertDirections, adjustStat, calculateSeekDirection, calculateBulletPosition, worldSaveData, scriptMixins, defaultStatusMessageStyle } from './object-functions.js';
import { startTileAnimation, updateAnimations } from './animations.js';

// Canvas Configurations
const displayWidth = 1154;
const displayHeight = 800;
const canvas = document.getElementById('lowToleranceCanvas');
const scale = 1;
canvas.style.width = displayWidth + 'px';
canvas.style.height = displayHeight + 'px';
canvas.width = displayWidth * scale;
canvas.height = displayHeight * scale;
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

// Game configurations
let placedSprites = {};
const tileSizeX = 32;                // Single tile size
const tileSizeY = 32;
const tilesX = 36;                   // Board width and height
const tilesY = 25;
const hiddenLayers = new Set();      // Set to hold hidden layers
const keys = {};                     // Hold key states
const offscreenTile = new OffscreenCanvas(tileSizeX, tileSizeY);
const offscreenCtx = offscreenTile.getContext('2d');
const layerCanvases = {};            // Stores canvases for layers
const layerContexts = {};            // Stores 2D contexts for layers
let placedObjects = {};              // Stores objects on the board
let placedPassages = {};             // Stores passages on the board
let gamePaused = false;              // Game pause state
let playerPaused = false;            // Player pause state
let bulletArray = [];
const scriptGlobals = {};            // Global variables for scripts
const spriteCache = {};              // Cache for sprites to avoid redundant redrawing
//const namedColors = namedColorList;// Named colors for easy reference

// board variables
let currentBoard = 2;                // Current board number
let boards = {};
let boardData = {};                  // Stores metadata for each board
let loaded = false;
let nightMode = true;

// World variables
let world = {};                      // World object
let worldObjects = {};               // Stores objects for all boards
let worldPassages = {};              // Stores passages for all boards
const scriptFlags = {};              // Stores all set flags as { flagName: true }

const messageStylePresets = {
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

// Player variables
let player = structuredClone(defaultPlayerStats); // Player object
let playerStats = structuredClone(defaultPlayerStats);
//let stats = playerStats;
const stepSize = player.stepSize;    // Step size for player movement

// File info
export let filename = ''; // ############ File to load ###############

// Timing
let fps = 60;
let lastTime = 0;                    // Timing variables
let moveSpeed = 80;                  // Pixels per second
let accumulatedTime = 0;

// #################################################
// ############ Main animation function ############
// #################################################

export function animateGame(currentTime) {
    if (gamePaused || playerPaused) return; // Stop the loop when the game is paused

    const deltaTime = currentTime - lastTime;

    if (deltaTime > 1000 / fps) { // 60 FPS cap
        // Update the position based on the speed and deltaTime
        lastTime = currentTime;

        //position += speed * (deltaTime / 1000) * 60;
        updateBullets();
        updateObjects(deltaTime);
        updatePlayer(deltaTime);

        //if (loaded) renderLayersToMainCanvas();
        //else drawDefaultTitleScreen();
        renderLayersToMainCanvas();

        if (player.flashRed) {
            player.flashTimer -= deltaTime;
            if (player.flashTimer <= 0) {
                player.flashRed = false;
                player.flashTimer = 0;
            }
        }

    }

    // Loop the animation
    requestAnimationFrame(animateGame);
}

// ############ End of main animation function ############ 

// ###########################################
// ############ Drawing functions ############
// ###########################################

function updateBullets() {

    bulletArray.forEach((bullet, index) => {

        bullet.update();

        renderLayersToMainCanvas();
        if (!canMoveTo(bullet.x / 32, bullet.y / 32, bullet)) bullet.active = false;

        // Remove bullets that are inactive
        if (!bullet.active) {
            bulletArray.splice(index, 1);
            renderLayersToMainCanvas();
        }
    });
    bulletArray = bulletArray.filter(bullet => bullet.active);
}

function getLayerCanvas(layer) {
    if (!layerCanvases[layer]) {
        // Create OffscreenCanvas for the layer
        layerCanvases[layer] = new OffscreenCanvas(tilesX * tileSizeX, tilesY * tileSizeY);
        layerContexts[layer] = layerCanvases[layer].getContext('2d');
    }
    return layerContexts[layer];
}

function drawBoard() {
    const sortedLayers = [1, 2, 3];

    for (const layer of sortedLayers) {
        const ctx = getLayerCanvas(layer);

        // CLEAR OFFSCREEN CANVAS BEFORE DRAWING
        ctx.clearRect(0, 0, layerCanvases[layer].width, layerCanvases[layer].height);

        Object.keys(placedSprites)
            .map(key => {
                const [l, x, y] = key.split(',').map(Number);
                return { l, x, y, ...placedSprites[key] };
            })
            .filter(sprite => sprite.l === layer && sprite.type !== 'passage' && sprite.type !== 'invisible') // Skip rendering passages
            .forEach(sprite => {
                if (sprite.type !== 'player') { // Skip player and invisible sprites
                    drawSpriteToCanvas(ctx, sprite.x, sprite.y, tileSizeX, tileSizeY, sprite.sprite, sprite.color);
                }
            });
        //console.log(`Layer ${layer} generated`);
    }
}

function updateTile(layer, x, y) {
    const ctx = getLayerCanvas(layer);

    // Clear only the affected tile instead of the whole layer
    ctx.clearRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY);

    const spriteKey = `${layer},${x},${y}`;
    if (placedSprites[spriteKey]) {
        const sprite = placedSprites[spriteKey];
        drawSpriteToCanvas(ctx, x, y, tileSizeX, tileSizeY, sprite.sprite, sprite.color);
    }
}

function renderLayersToMainCanvas() {
    //console.time('renderLayersToMainCanvas'); // Start timing
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the main canvas
    const sortedLayers = [1, 2, 3];

    for (const layer of sortedLayers) {
        if (hiddenLayers.has(layer)) {
            if (layer === player.layer) {
                drawPlayerAndBulletsToCanvas(); // Draw player and bullets on top of the player layer
            }
            continue; // <-- Skip hidden layers
        }

        if (layerCanvases[layer]) {
            ctx.drawImage(layerCanvases[layer], 0, 0);
        } else {
            console.warn(`Layer ${layer} is missing!`); // Debugging
        }
        if (layer === player.layer) {
            drawPlayerAndBulletsToCanvas(); // Draw player and bullets on top of the player layer
        }
    }
    if (nightMode) {

        // 1. Draw the dark overlay
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // "Cut out" light circles
        ctx.globalCompositeOperation = "divide"; // Use 'divide' to cut out light areas
        let cx = (player.x + 0.5) * tileSizeX;
        let cy = (player.y + 0.5) * tileSizeY;
        let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 96);
        grad.addColorStop(0, "rgba(255,255,220,0.5)");   // Bright center
        grad.addColorStop(1, "rgba(255,255,220,0)");     // Fully transparent at edge

        ctx.beginPath();
        ctx.arc(cx, cy, 96, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // You can add more lights for torches, objects, etc. here
        ctx.restore();
    }

    //console.timeEnd('renderLayersToMainCanvas'); // End timing
}

function drawPlayerAndBulletsToCanvas() {
    ctx.save();
    ctx.shadowColor = "white";
    ctx.shadowBlur = 10;
    ctx.drawImage(getCachedSprite(player.sprite, player.color), player.x * tileSizeX, player.y * tileSizeY);

    // Draw red tint if flashing
    if (player.flashRed) {
        offscreenCtx.clearRect(0, 0, tileSizeX, tileSizeY);
        offscreenCtx.drawImage(getSprite(player.sprite, player.color), 0, 0);

        offscreenCtx.globalCompositeOperation = "source-in";
        let alpha = Math.max(0, player.flashTimer / 200);
        offscreenCtx.globalAlpha = 0.5 * alpha;
        offscreenCtx.fillStyle = "red";
        offscreenCtx.fillRect(0, 0, tileSizeX, tileSizeY);
        offscreenCtx.globalAlpha = 1.0;
        offscreenCtx.globalCompositeOperation = "source-over";

        ctx.drawImage(offscreenTile, player.x * tileSizeX, player.y * tileSizeY);
    }

    bulletArray.forEach(bullet => {
        bullet.draw();
    });
    ctx.restore();
}

function drawSpriteToCanvas(ctx, x, y, tileSizeX, tileSizeY, sprite, color) {
    drawSprite(x, y, tileSizeX, tileSizeY, sprite, color, ctx); // Draw sprite on given canvas
}

function clearTile(x, y) {
    ctx.clearRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY);
}

function getSpriteCacheKey(spriteNum, color) {
    // Flatten color array for key (handles both [r,g,b,a],[r,g,b,a])
    return `${spriteNum}_${color.flat().join(',')}`;
}

function getCachedSprite(spriteNum, color) {
    const key = getSpriteCacheKey(spriteNum, color);
    if (spriteCache[key]) {
        return spriteCache[key];
    }
    // Use getSprite from sprite.js to build the sprite
    const spriteCanvas = getSprite(spriteNum, color);
    // Clone the canvas to avoid overwriting (if using OffscreenCanvas, you may need to create a new one)
    const off = new OffscreenCanvas(tileSizeX, tileSizeY);
    const offCtx = off.getContext('2d');
    offCtx.drawImage(spriteCanvas, 0, 0, tileSizeX, tileSizeY);
    spriteCache[key] = off;
    return off;
}

function drawDefaultTitleScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.font = "bold 32px Arial";
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    ctx.fillText("Low Tolerance Zoo", 16, 16);

    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#ff0";
    ctx.fillText("Press F3 to load a world", 16, 64);

    ctx.font = "16px Arial";
    ctx.fillStyle = "#ccc";
    ctx.fillText("ARROW keys to move | SPACE to shoot | P to pause | F for console stats | R force redraw", 16, 100);
    ctx.restore();
}

// ##########################################
// ############ Object functions ############
// ##########################################

function updateObjects(deltaTime) {
    const objectsToUpdate = Object.values(placedObjects).filter(obj => !obj.resting);

    for (let obj of objectsToUpdate) {
        // Handle waiting state
        if (obj.waiting) {
            //console.log(`Object ${obj.name || 'unknown'} is waiting. Time left: ${obj.waitTime}`);
            obj.waitTime -= deltaTime; // Decrement waitTime
            if (obj.waitTime <= 0) {
                obj.waiting = false; // Reset waiting state
            }
            continue; // Skip executing new commands while waiting
        }

        // Process objects that are not waiting
        obj.timeSinceLastMove += deltaTime;
        if (obj.timeSinceLastMove >= obj.moveInterval) {
            while (obj.scriptIndex < obj.script.length) {
                let command = obj.script[obj.scriptIndex];
                if (obj.scriptIndex == undefined) {
                    console.error("Error: scriptIndex is undefined for object", obj.name || 'unknown');
                    break;
                }
                executeObjectCommand(obj, command);

                // Handle #loop command immediately
                if (command.type === "command" && command.name === "loop") {
                    if (obj.labels[":loop"] !== undefined) {
                        obj.scriptIndex = obj.labels[":loop"];
                    } else {
                        console.error("Error: Missing ':loop' label in script.");
                    }
                    break; // Stop further execution this tick
                }

                // If the command is blocking or the object is now waiting, stop here
                if (command.blocking || obj.waiting) {
                    obj.scriptIndex++;
                    break;
                }
                obj.scriptIndex++;
            }

            // Auto-stop if script ends without `#end`
            if (obj.scriptIndex >= obj.script.length) {
                obj.resting = true;
            }

            obj.timeSinceLastMove = 0;
        }
    }
}

function executeObjectCommand(obj, command) {
    switch (command.type) {
        case "name":
            obj.name = command.value;
            break;
        case "status":
            // Use the object's style (set via #message on that object)
            if (!obj.statusMessageStyle) obj.statusMessageStyle = { ...defaultStatusMessageStyle };
            showStatusMessage(command.text, obj.statusMessageStyle.duration, obj.statusMessageStyle);
            break;
        case "command":
            switch (command.name) {
                case "text": {
                    // Legacy #text command: display dialog and pause game
                    if (!command.args.length) {
                        console.warn("#text: No text provided.");
                        break;
                    }
                    const dialogText = command.args.join(" ");
                    gamePaused = true;
                    showDialog(dialogText, obj);
                    break;
                }
                case "bind": {
                    if (!command.args[0] || !command.args[0].startsWith("@")) {
                        console.warn("#bind: No valid source object name provided.");
                        break;
                    }
                    const sourceName = command.args[0].slice(1);
                    const sourceObj = Object.values(placedObjects).find(o => o.name === sourceName);
                    if (!sourceObj) {
                        console.warn(`#bind: Source object "${sourceName}" not found.`);
                        break;
                    }
                    // Deep copy script and labels
                    obj.script = JSON.parse(JSON.stringify(sourceObj.script));
                    obj.labels = JSON.parse(JSON.stringify(sourceObj.labels));
                    obj.scriptIndex = 0;
                    obj.zappedLabels = {}; // Reset zapped labels
                    obj.name = sourceObj.name;
                    console.log(`#bind: Bound script from "${sourceName}" to "${obj.name || obj.id}"`);
                    break;
                }
                case "if": {
                    // Basic: #if <flag> then <:label>
                    const flag = command.args[0]?.toLowerCase();
                    const thenIndex = command.args.indexOf("then");
                    const label = thenIndex !== -1 ? command.args[thenIndex + 1] : null;

                    if (!flag || !label) {
                        console.warn("#if: Invalid syntax. Usage: #if <flag> then <:label>");
                        break;
                    }

                    if (scriptFlags[flag]) {
                        // Jump to the label if the flag is set
                        let labelKey = label.startsWith(":") ? label : ":" + label;
                        const index = resolveLabel(obj, labelKey);
                        if (index !== null) {
                            obj.scriptIndex = index - 1; // -1 so next tick runs the label's first command
                        } else {
                            console.warn(`#if: Label ${labelKey} not found.`);
                        }
                    }
                    break;
                }

                // Status Messages go here

                case "wait":
                    obj.waitTime = Number(command.args[0]) * 50 || 50;
                    obj.waiting = true;
                    break;
                case 'idle':
                case "sleep":
                    obj.waitTime = Number(command.args[0]) * 1000 || 1000;
                    obj.waiting = true;
                    break;
                case "cycle":
                    obj.moveInterval = (Number(command.args[0]) || 1) * (1000 / fps); // n ticks
                    break;
                case "end":
                    obj.resting = true;
                    break;
                case "loop":
                    if (obj.labels[":loop"] !== undefined) {
                        obj.scriptIndex = obj.labels[":loop"];
                    } else {
                        console.error("Error: Missing ':loop' label in script.");
                    }
                    break;
                case "step": // STEP NEEDS TO COME BEFORE MOVE
                    // Set fullStep to true to use full-tile step
                    obj.fullStep = true;
                case "step": // STEP NEEDS TO COME BEFORE MOVE
                    obj.fullStep = true;
                case "move": {
                    const moveParams = resolveMoveParams(obj, command.args);
                    if (!moveParams) {
                        console.warn(`Invalid direction "${command.args.join(' ')}" provided for #${command.name}`);
                        break;
                    }
                    moveObject(obj, moveParams.direction, obj.layer, moveParams.step);
                    break;
                }
                case "try": {
                    const moveParams = resolveMoveParams(obj, command.args);
                    if (!moveParams) {
                        console.warn(`Invalid direction "${command.args.join(' ')}" provided for #try`);
                        break;
                    }
                    const moved = moveObject(obj, moveParams.direction, obj.layer, moveParams.step);
                    if (moved) break;

                    const fallbackArgs = command.args.slice(moveParams.argsUsed);
                    if (!fallbackArgs.length) break;

                    const first = fallbackArgs[0];
                    if (first.startsWith(":")) {
                        const label = first;
                        const index = resolveLabel(obj, label);
                        if (index !== null) obj.scriptIndex = index - 1;
                        else console.warn(`#try: Label ${label} not found.`);
                    } else {
                        const fallbackCommand = {
                            type: "command",
                            name: first.toLowerCase(),
                            args: fallbackArgs.slice(1),
                            blocking: false
                        };
                        executeObjectCommand(obj, fallbackCommand);
                    }
                    break;
                }
                case "moveto":
                case "moveTo": {
                    // Support "#moveto 5 16", "#moveto 5,16", "#moveto 5, 16", and optional "force"
                    let targetX, targetY;
                    let force = false;
                    let args = command.args.slice();

                    // Check for 'force' as the last argument
                    if (args[args.length - 1] === 'force') {
                        force = true;
                        args = args.slice(0, -1); // Remove 'force' from args
                    }

                    if (args.length === 1 && args[0].includes(',')) {
                        [targetX, targetY] = args[0].split(',').map(s => parseInt(s.trim(), 10));
                    } else if (args.length >= 2) {
                        targetX = parseInt(args[0].replace(',', ''), 10);
                        targetY = parseInt(args[1].replace(',', ''), 10);
                    }
                    if (
                        isNaN(targetX) || isNaN(targetY) ||
                        targetX < 0 || targetY < 0 || targetX >= tilesX || targetY >= tilesY
                    ) {
                        console.warn('Invalid arguments for #moveto. Expected two numbers.');
                        break;
                    }
                    let targetKey = `${obj.layer},${targetX},${targetY}`;
                    if (
                        (!force && placedObjects[targetKey] && placedObjects[targetKey].id !== obj.id) ||
                        (!force && placedSprites[targetKey]) ||
                        (placedSprites[targetKey] && placedSprites[targetKey].type === 'passage') ||
                        (placedSprites[targetKey] && placedSprites[targetKey].type === 'player')
                    ) {
                        console.warn(`Target tile (${targetX}, ${targetY}) is occupied by another object.`);
                        break; // Prevent moving to an occupied tile
                    }
                    // If force, destroy whatever is at the target location
                    if (force) {
                        if (placedObjects[targetKey]) delete placedObjects[targetKey];
                        if (placedSprites[targetKey]) delete placedSprites[targetKey];
                    }
                    // Move the object to the specified coordinates
                    let oldKey = `${obj.layer},${obj.x},${obj.y}`;
                    placedSprites[targetKey] = placedSprites[oldKey]; // Move sprite
                    placedObjects[targetKey] = obj;
                    delete placedObjects[oldKey];
                    delete placedSprites[oldKey];
                    updateTile(obj.layer, obj.x, obj.y); // Clear old tile
                    obj.x = targetX;
                    obj.y = targetY;
                    updateTile(obj.layer, obj.x, obj.y); // Update new tile
                    console.log(`Moved object to (${targetX}, ${targetY})${force ? ' with force' : ''}`);
                    break;
                }
                case "change": {
                    if (!command.args[0] || isNaN(parseInt(command.args[0], 10))) {
                        console.warn(`#change: Missing or invalid sprite number: ${command.args[0]}`);
                        break;
                    }
                    let spriteNumber = parseInt(command.args[0], 10);

                    // Check for enough arguments for colors
                    if (!command.args[1]) {
                        console.warn(`#change: Missing color arguments.`);
                        break;
                    }

                    let dark, light;
                    if (command.args[1].startsWith("(")) {
                        // RGB format: must have at least 6 color values (3 for dark, 3 for light)
                        if (command.args.length < 7) {
                            console.warn(`#change: Not enough RGB values. Expected 6, got ${command.args.length - 1}.`);
                            break;
                        }
                        dark = extractRGB(command.args.slice(1, 4).join(" "));
                        light = extractRGB(command.args.slice(4, 7).join(" "));
                    } else {
                        // Named colors: must have at least 2 color names
                        if (!command.args[2]) {
                            console.warn(`#change: Missing second color name.`);
                            break;
                        }
                        dark = namedColors[command.args[1]] || [0, 0, 0]; // Default to black if not found
                        light = namedColors[command.args[2]] || [255, 255, 255]; // Default to white if not found
                    }

                    // Apply sprite change
                    obj.sprite = spriteNumber;
                    obj.color = [dark, light];

                    placedSprites[`${obj.layer},${obj.x},${obj.y}`].sprite = spriteNumber;
                    placedSprites[`${obj.layer},${obj.x},${obj.y}`].color = [dark, light];
                    updateTile(obj.layer, obj.x, obj.y); // Update tile with new sprite
                    renderLayersToMainCanvas(); // Ensure visual update
                    break;
                }
                case "changecolor":
                case "changeColor":
                case "color": {
                    if (!command.args[0]) {
                        console.warn("#changecolor: No color provided");
                        break;
                    }
                    let color = extractRGB(command.args[0]);
                    let spriteKey = `${obj.layer},${obj.x},${obj.y}`;
                    if (placedSprites[spriteKey]) {
                        placedSprites[spriteKey].color = color;
                    }
                    if (placedObjects[spriteKey]) {
                        placedObjects[spriteKey].color = color;
                    }
                    updateTile(obj.layer, obj.x, obj.y);
                    renderLayersToMainCanvas();
                    break;
                }
                case "changesprite":
                case "changeSprite":
                case "sprite": {
                    if (!command.args[0] || isNaN(command.args[0])) {
                        console.warn("#changesprite: No sprite provided or NaN");
                        break;
                    }
                    let spriteKey = `${obj.layer},${obj.x},${obj.y}`;
                    let spriteNum = parseInt(command.args[0], 10);
                    if (placedSprites[spriteKey]) {
                        placedSprites[spriteKey].sprite = spriteNum;
                    }
                    if (placedObjects[spriteKey]) {
                        placedObjects[spriteKey].sprite = spriteNum;
                    }
                    updateTile(obj.layer, obj.x, obj.y);
                    renderLayersToMainCanvas();
                    break;
                }
                case "give": {
                    let item = command.args[0];
                    let amount = parseInt(command.args[1], 10);
                    if (isNaN(amount)) amount = 1; // Default to 1 if not specified
                    adjustStat(player, item, amount);
                    console.log(`Gave ${amount} ${item}(s)`);
                    break;
                }
                case "take": {
                    let item = command.args[0];
                    let amountArg = command.args[1];
                    let amount;

                    // Support "all" and "half"
                    if (typeof amountArg === "string" && amountArg.toLowerCase() === "all") {
                        amount = player.stats[item] || 0;
                        console.log(`Taking all of ${item}, which is ${amount}, player ${player.stats[item]}`); // Debugging
                    } else if (typeof amountArg === "string" && amountArg.toLowerCase() === "half") {
                        amount = Math.floor((player.stats[item] || 0) / 2);
                    } else {
                        amount = parseInt(amountArg, 10);
                        if (isNaN(amount)) amount = 1; // Default to 1 if not specified
                    }

                    if (amount <= 0) amount = 1; // Ensure at least 1 is taken

                    // Optional label as last argument
                    let label = null;
                    if (command.args.length > 2) {
                        label = command.args[command.args.length - 1];
                        if (!isNaN(label)) label = null;
                    }

                    // Check if player has enough of the stat
                    if (player.stats[item] === undefined || (player.stats[item] < amount && item !== 'health')) {
                        if (label && obj.labels && obj.labels[`:${label}`] !== undefined) {
                            obj.scriptIndex = obj.labels[`:${label}`] - 1;
                            return;
                        }
                        console.warn(`Not enough ${item} to take. No label provided.`);
                        return;
                    }

                    adjustStat(player, item, -amount);
                    if (player.stats.health <= 0) youDied();
                    console.log(`Took ${amount} ${item}(s)`);
                    break;
                }
                case "lock":
                    obj.locked = true;
                    break;
                case "unlock":
                    obj.locked = false;
                    break;
                case "let": {
                    // Usage: #let $var = value
                    let varName = command.args[0];
                    if (!varName || !varName.startsWith('$')) {
                        console.warn("#let: Global variable names must start with $");
                        break;
                    }
                    // Find '=' and join everything after as the value
                    let eqIndex = command.args.indexOf('=');
                    let value = eqIndex !== -1
                        ? command.args.slice(eqIndex + 1).join(" ").replace(/^"|"$/g, '')
                        : command.args.slice(1).join(" ").replace(/^"|"$/g, '');
                    scriptGlobals[varName] = value;
                    break;
                }
                case "set": {
                    if (!command.args[0]) {
                        console.warn("#set: No flag provided.");
                        break;
                    }
                    const flag = command.args[0].toLowerCase();
                    scriptFlags[flag] = true;
                    break;
                }
                case "clear": {
                    if (!command.args[0]) {
                        console.warn("#clear: No flag provided.");
                        break;
                    }
                    const flag = command.args[0].toLowerCase();
                    delete scriptFlags[flag];
                    break;
                }
                // -------------------------
                // Per-object #message / #msg
                // Usage examples:
                //   #message x 20
                //   #msg duration 3000
                //   #message color #fff bgcolor #000
                //   #message style "width:80%;background:#222;color:#fff;"
                //   #message preset alert
                // -------------------------
                case "message":
                case "msg": {
                    // ensure object style exists
                    if (!obj.statusMessageStyle) obj.statusMessageStyle = { ...defaultStatusMessageStyle };

                    if (!command.args || command.args.length === 0) {
                        console.warn("#message: expected arguments (preset, x, y, duration, color, bgColor, font, style).");
                        break;
                    }

                    const first = String(command.args[0]).toLowerCase();

                    // RESET handling: #message reset
                    if (first === "reset") {
                        obj.statusMessageStyle = { ...defaultStatusMessageStyle };
                        break;
                    }

                    // preset handling: #message preset <name>
                    if (first === "preset") {
                        const presetName = command.args[1];
                        if (!presetName) {
                            console.warn("#message preset: missing preset name.");
                            break;
                        }
                        const preset = messageStylePresets[presetName];
                        if (!preset) {
                            console.warn(`#message preset: unknown preset "${presetName}".`);
                            break;
                        }
                        // apply preset onto a fresh style object
                        obj.statusMessageStyle = { ...defaultStatusMessageStyle, ...preset };
                        // keep any cssString already present on the preset (if created elsewhere)
                        if (preset.cssString) obj.statusMessageStyle.cssString = preset.cssString;
                        break;
                    }

                    // Generic key/value parsing. 'style' consumes the rest of the args as a CSS string.
                    for (let i = 0; i < command.args.length; i++) {
                        const key = String(command.args[i]).toLowerCase();

                        if (key === "style") {
                            // join remaining args as a single CSS string, strip surrounding quotes
                            const css = command.args.slice(i + 1).join(" ").replace(/^"|"$/g, "").trim();
                            obj.statusMessageStyle.cssString = css;
                            break; // style is last / consumes rest
                        }

                        const value = command.args[i + 1];
                        if (value === undefined) break;

                        if (key === "x") {
                            const n = Number(value);
                            obj.statusMessageStyle.x = isNaN(n) ? null : n;
                            i++;
                            continue;
                        }
                        if (key === "y") {
                            const n = Number(value);
                            obj.statusMessageStyle.y = isNaN(n) ? null : n;
                            i++;
                            continue;
                        }
                        if (key === "duration") {
                            const n = Number(value);
                            if (!isNaN(n)) obj.statusMessageStyle.duration = n;
                            i++;
                            continue;
                        }
                        if (key === "color") {
                            obj.statusMessageStyle.color = String(value).replace(/^"|"$/g, "");
                            i++;
                            continue;
                        }
                        if (key === "bgcolor" || key === "bgColor" || key === "background") {
                            obj.statusMessageStyle.bgColor = String(value).replace(/^"|"$/g, "");
                            i++;
                            continue;
                        }
                        if (key === "font") {
                            obj.statusMessageStyle.font = String(value).replace(/^"|"$/g, "");
                            i++;
                            continue;
                        }

                        // Unknown key — skip one to avoid infinite loop
                        console.warn(`#message: unknown key "${key}"`);
                        i++;
                    }

                    break;
                }
                // End status message handling
                case "shoot": {
                    if (!command.args[0]) {
                        console.warn('#shoot: No direction provided');
                        break;
                    }

                    let direction = command.args[0];
                    let opp = false;

                    // Handle 'opp' modifier
                    if (direction === 'opp') {
                        opp = true;
                        direction = command.args[1];
                    }

                    // Handle 'flow'
                    if (direction === 'flow') {
                        direction = obj.direction || 'right'; // Default to right if undefined
                        if (opp) {
                            switch (direction) {
                                case 'up': direction = 'down'; break;
                                case 'down': direction = 'up'; break;
                                case 'left': direction = 'right'; break;
                                case 'right': direction = 'left'; break;
                            }
                        }
                    } else if (direction === 'seek') {
                        direction = calculateSeekDirection(obj, player);
                        if (opp) {
                            switch (direction) {
                                case 'up': direction = 'down'; break;
                                case 'down': direction = 'up'; break;
                                case 'left': direction = 'right'; break;
                                case 'right': direction = 'left'; break;
                            }
                        }
                    } else {
                        direction = convertDirections(direction);
                        if (opp && direction !== -1) {
                            switch (direction) {
                                case 'up': direction = 'down'; break;
                                case 'down': direction = 'up'; break;
                                case 'left': direction = 'right'; break;
                                case 'right': direction = 'left'; break;
                            }
                        }
                    }

                    if (direction === -1) {
                        console.warn(`#shoot: Invalid direction "${command.args.join(' ')}"`);
                        break;
                    }

                    let { x, y } = calculateBulletPosition(obj.x, obj.y, direction);
                    let bullet = createBullet(canvas, x, y, direction, 16, 'white', obj.name);
                    bullet.origin = `${obj.layer},${obj.x},${obj.y}`;
                    bulletArray.push(bullet);
                    console.log(`Creating bullet at (${x}, ${y}) with direction ${direction}`);
                    break;
                }
                case 'hurt':
                    player.flashRed = true;
                    player.flashTimer = 200; // flash for 200ms
                    break;
                case 'die':
                    //console.log("object died via #die command");
                    delete placedObjects[`${obj.layer},${obj.x},${obj.y}`];
                    delete placedSprites[`${obj.layer},${obj.x},${obj.y}`];
                    updateTile(obj.layer, obj.x, obj.y);
                    break;
                case "zapall":
                    // Zap all labels in the object
                    for (let label in obj.labels) {
                        if (label.startsWith(":")) {
                            obj.zappedLabels[label] = (obj.zappedLabels[label] || 0) + 1;
                        }
                    }
                    obj.labels = {}; // Clear all labels
                    break;
                case "zap": {
                    const zapLabel = command.args[0].startsWith(":") ? command.args[0] : ":" + command.args[0];
                    if (!obj.zappedLabels[zapLabel]) {
                        obj.zappedLabels[zapLabel] = 1;
                    } else {
                        obj.zappedLabels[zapLabel]++;
                    }
                    break;
                }
                case "use": {
                    const mixinName = command.args[0];
                    if (scriptMixins[mixinName]) {
                        // Insert mixin commands into the current script at the current index
                        obj.script.splice(obj.scriptIndex + 1, 0, ...scriptMixins[mixinName]);
                    } else {
                        console.warn(`#use: Mixin "${mixinName}" not found.`);
                    }
                    break;
                }
                case "restore": {
                    const restoreLabel = command.args[0].startsWith(":") ? command.args[0] : ":" + command.args[0];
                    delete obj.zappedLabels[restoreLabel];
                    break;
                }
                case "send": {
                    if (command.args.length === 1) {
                        // Jump to a label within the same object
                        let label = command.args[0];
                        if (!label.startsWith(":")) label = ":" + label;
                        const index = resolveLabel(obj, label);
                        if (index !== null) {
                            obj.scriptIndex = index - 1;
                        } else {
                            console.error(`Error: Label ${label} not found in script.`);
                        }
                    } else if (command.args.length === 2 && command.args[0].startsWith("@")) {
                        const targetName = command.args[0].slice(1);
                        let label = command.args[1];
                        if (!label.startsWith(":")) label = ":" + label;
                        const targetObjects = Object.values(placedObjects).filter(o => o.name === targetName);
                        if (targetObjects.length === 0) {
                            console.error(`Error: Object with name "${targetName}" not found.`);
                            break;
                        }
                        for (const targetObject of targetObjects) {
                            if (targetObject.locked) {
                                console.warn(`Object "${targetName}" is locked and cannot receive #send.`);
                                continue;
                            }
                            const index = resolveLabel(targetObject, label);
                            if (index !== null) {
                                targetObject.scriptIndex = index;
                                targetObject.resting = false;
                            } else {
                                console.error(`Error: Label ${label} not found in object "${targetName}".`);
                            }
                        }
                    } else {
                        console.error(`Error: Invalid #send command arguments: ${command.args.join(" ")}`);
                    }
                    break;
                }
                case "hideLayer":
                case "hidelayer": {
                    let layerToHide = parseInt(command.args[0], 10);
                    if (isNaN(layerToHide) || layerToHide < 1 || layerToHide > 3) {
                        console.warn(`#hidelayer: Invalid layer number: ${command.args[0]}`);
                        break;
                    }
                    if (hiddenLayers.has(layerToHide)) {
                        console.warn(`#hidelayer: Layer ${layerToHide} is already hidden.`);
                        break;
                    }
                    hiddenLayers.add(layerToHide);
                    renderLayersToMainCanvas();
                    break;
                }
                case "showLayer":
                case "showlayer": {
                    let layerToShow = parseInt(command.args[0], 10);
                    if (isNaN(layerToShow) || layerToShow < 1 || layerToShow > 3) {
                        console.warn(`#showlayer: Invalid layer number: ${command.args[0]}`);
                        break;
                    }
                    hiddenLayers.delete(layerToShow);
                    renderLayersToMainCanvas();
                    break;
                }
                case "maybe": {
                    if (Math.random() >= 0.5) break; // 50% chance to skip

                    if (!command.args.length) {
                        console.warn("#maybe: expected a command or label to execute.");
                        break;
                    }

                    const first = command.args[0];

                    // Label target (e.g., #maybe :attack)
                    if (first.startsWith(":")) {
                        const index = resolveLabel(obj, first);
                        if (index !== null) {
                            obj.scriptIndex = index - 1;
                        } else {
                            console.warn(`#maybe: Label ${first} not found.`);
                        }
                        break;
                    }

                    // Command target (e.g., #maybe hidelayer 3)
                    const maybeCommand = {
                        type: "command",
                        name: first.toLowerCase(),
                        args: command.args.slice(1),
                        blocking: false
                    };
                    executeObjectCommand(obj, maybeCommand);
                    break;
                }
                case 'nightmode':
                    nightMode = !nightMode;
                    break;
                case "debug":
                    console.log("DEBUG: Object script:", obj.script);
                    console.log("DEBUG: Object labels:", obj.labels);
                    break;
                // Add more command handlers here...
                default: {
                    // Try to treat unknown command as a label jump
                    let labelKey = command.name;
                    if (labelKey.startsWith("#")) labelKey = labelKey.slice(1);
                    if (!labelKey.startsWith(":")) labelKey = ":" + labelKey;
                    if (obj.labels && obj.labels[labelKey] !== undefined) {
                        obj.scriptIndex = obj.labels[labelKey] - 1;
                        return;
                    }
                    console.warn(`Unknown command or label: #${command.name}`);
                    break;
                }
            }
            break;
        case "text":
            gamePaused = true; // Pause the game loop
            showDialog(command.text, obj);
            break;
        // Add more types as needed
        default:
            console.warn(`Unknown script type: ${command.type}`);
    }
}

function getOppositeDirection(dir) {
    switch (dir) {
        case 'up': return 'down';
        case 'down': return 'up';
        case 'left': return 'right';
        case 'right': return 'left';
        default: return dir;
    }
}

function resolveMoveParams(obj, args = []) {
    if (!args.length) return null;

    let index = 0;
    let token = args[index];
    let opp = false;

    if (token === 'opp') {
        opp = true;
        index++;
        token = args[index];
        if (!token) return null;
    }

    let direction;
    if (token === 'rndany' || token === 'random') {
        const dirs = ['up', 'down', 'left', 'right'];
        direction = dirs[Math.floor(Math.random() * dirs.length)];
    } else if (token === 'seek') {
        direction = calculateSeekDirection(obj, player);
        if (!direction) return null;
    } else {
        direction = convertDirections(token);
        if (direction === -1) return null;
    }
    if (opp) direction = getOppositeDirection(direction);

    const step = obj.fullStep ? 1 : 0.5;
    obj.fullStep = false;

    return { direction, step, argsUsed: index + 1 };
}

function moveObject(obj, direction, layer, step = 0.5) {
    const offsets = { up: [0, -step], down: [0, step], left: [-step, 0], right: [step, 0] };
    const dir = convertDirections(direction);

    if (!offsets[dir]) {
        console.warn(`Invalid direction: ${direction} for move`);
        return false;
    }

    const [dx, dy] = offsets[dir];
    const [newX, newY] = [obj.x + dx, obj.y + dy];

    const oldKey = `${layer},${obj.x},${obj.y}`;
    const newKey = `${layer},${newX},${newY}`;
    obj.direction = dir;

    if (canMoveTo(newX, newY, obj)) {
        placedSprites[newKey] = placedSprites[oldKey];
        placedObjects[newKey] = obj;

        delete placedObjects[oldKey];
        delete placedSprites[oldKey];

        updateTile(layer, obj.x, obj.y);

        obj.x = newX;
        obj.y = newY;

        updateTile(layer, obj.x, obj.y);
        return true;
    } else {
        handleObjectInteraction(oldKey, ":thud");
        return false;
    }
}

function handleObjectInteraction(tileKey, labelType) {
    let obj = placedObjects[tileKey];
    if (obj && obj.locked) return; // Prevent interaction if locked
    if (obj && obj.labels[labelType]) {
        let index = resolveLabel(obj, labelType);
        if (index !== null) {
            obj.scriptIndex = index - 1; // For player or other types, use index directly
            obj.waitTime = 0; // Reset wait time
            obj.waiting = false; // Reset waiting state
        } else {
            console.warn(`No active ${labelType} labels found.`);
        }
        obj.resting = false; // Wake up the object
    }
}

function handlePlayerInteraction(tileKey, labelType) {
    let obj = placedObjects[tileKey];
    if (obj && obj.locked) return; // Prevent interaction if locked
    if (obj && obj.labels[labelType]) {
        let labelKey = labelType.startsWith(":") ? labelType : ":" + labelType;
        let index = resolveLabel(obj, labelKey);
        if (index !== null) {
            if (obj.type === 'object') {
                obj.scriptIndex = index; // For objects, so next tick runs the label's first command
                obj.waitTime = 0;
                obj.waiting = false;
                obj.resting = false;
            }
            // Set the flag to prevent repeated triggers
            player.justInteracted = true;
        } else {
            console.warn(`No active ${labelType} labels found.`);
        }
    }
}

function runImmediateLabel(obj, labelType) {
    let labelKey = labelType.startsWith(":") ? labelType : ":" + labelType;
    let index = resolveLabel(obj, labelKey);
    if (index === null) return;

    obj.scriptIndex = index;
    obj.waitTime = 0;
    obj.waiting = false;
    obj.resting = false;
    obj.moveInterval = 0; // Fastest possible speed (process immediately)


    // Option 1: Only execute the first command (like handlePlayerInteraction)
    let command = obj.script[obj.scriptIndex];
    if (command) {
        executeObjectCommand(obj, command);
        obj.scriptIndex++;
    }

    // Option 2: If you want to execute all non-blocking commands instantly, use this loop:
    /*
    while (obj.scriptIndex < obj.script.length) {
        let command = obj.script[obj.scriptIndex];
        if ((command.type === "command" && command.blocking) || command.type === "text") break;
        executeObjectCommand(obj, command);
        obj.scriptIndex++;
    }  wwwwwwwww
    */
}

canvas.addEventListener('click', function (event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; 
    const mouseY = event.clientY - rect.top;
    const { tileX, tileY } = getTileAtCanvasPosition(mouseX, mouseY);

    // Try all layers, top to bottom
    let obj = null; 
    for (let layer = 3; layer >= 1; layer--) {
        obj = getObjectAtTile(tileX, tileY, layer);
        if (obj && obj.labels && obj.labels[':click']) {
            runImmediateLabel(obj, ':click');
            break;
        }
    }
});

function substituteGlobals(args) {
    return args.map(arg =>
        arg.startsWith('$') && scriptGlobals[arg] !== undefined
            ? scriptGlobals[arg]
            : arg
    );
}

// ##############################################
// ############ Dialog box functions ############
// ##############################################

// Paginated text that appears in the dialog box (or bubble)

function paginateText(text, maxLength) { // Split text into pages
    let pages = [];
    let segments = text.split("<page>"); // Split by <page> tag

    for (let segment of segments) {
        let words = segment.trim().split(" ");
        let currentPage = "";

        for (let word of words) {
            if ((currentPage + word).length <= maxLength) {
                currentPage += word + " ";
            } else {
                pages.push(currentPage.trim());
                currentPage = word + " ";
            }
        }
        if (currentPage.trim()) {
            pages.push(currentPage.trim());
        }
    }

    return pages;
}

function showDialog(text, object = null) {
    let pages = paginateText(text, 200); // Adjust maxLength as needed
    let pageIndex = 0;
    const dialog = document.getElementById('dialog-box');

    // Set object name if available
    if (object && object.name) {
        dialog.setAttribute('data-object-name', object.name);
    } else {
        dialog.removeAttribute('data-object-name');
    }

    function updateDialog() {
        dialog.innerHTML = pages[pageIndex];

        // Add '...' indicator if there's another page
        if (pageIndex < pages.length - 1) {
            dialog.setAttribute('data-next', 'true');
        } else {
            dialog.removeAttribute('data-next');
        }

        dialog.style.display = 'flex';
    }

    let inputBlocked = true;
    updateDialog();

    setTimeout(() => inputBlocked = false, 300); // Block input for 300ms

    document.addEventListener('keydown', function nextPage(event) {
        if (inputBlocked) return;
        if (event.key === 'Enter' || event.key === ' ') {
            inputBlocked = true;
            pageIndex++;

            if (pageIndex < pages.length) {
                updateDialog();
                setTimeout(() => inputBlocked = false, 300);
            } else {
                dialog.style.display = 'none';
                gamePaused = false;
                document.removeEventListener('keydown', nextPage);
                requestAnimationFrame(animateGame);
            }
        }
    });
}

// Single status message 
function showStatusMessage(message, duration = defaultStatusMessageStyle.duration, style = {}) {
    // container: prefer element with id 'block' if present (editor/game layout), fall back to body
    const container = document.getElementById('block') || document.body;

    let el = document.getElementById('status-message');
    if (!el) {
        el = document.createElement('div');
        el.id = 'status-message';
        container.appendChild(el);
    }

    // Merge provided style with defaults
    const s = { ...defaultStatusMessageStyle, ...(style || {}) };

    // Build an inline css string (explicit and deterministic)
    const parts = [];

    // Positioning (centered horizontally by default)
    parts.push('position:absolute');
    parts.push('left:50%');
    parts.push('transform:translateX(-50%)');
    parts.push(`bottom:${(s.y !== null && s.y !== undefined) ? s.y + 'px' : '20px'}`);

    // Visual defaults
    parts.push('padding:8px 24px');
    parts.push('border-radius:6px');
    parts.push('pointer-events:none');
    parts.push('z-index:10000');
    parts.push('display:block');
    parts.push('text-align:center');
    parts.push('max-width:80%');
    parts.push('box-sizing:border-box');

    // Colors / font if provided
    if (s.bgColor) parts.push(`background:${s.bgColor}`);
    if (s.color) parts.push(`color:${s.color}`);
    if (s.font) parts.push(`font:${s.font}`);

    // Append any raw cssString last so it can override defaults
    if (s.cssString) {
        const css = String(s.cssString).replace(/^"|"$/g, '').trim();
        if (css) parts.push(css.replace(/;$/,''));
    }

    // Apply all styles at once
    el.style.cssText = parts.join(';') + ';';

    // Set message text (use textContent to avoid HTML injection)
    el.textContent = message;

    // Clear previous timeout and set hide timer
    clearTimeout(el._timeout);
    const hideAfter = (duration !== undefined && duration !== null) ? Number(duration) : s.duration;
    el._timeout = setTimeout(() => {
        el.style.display = 'none';
    }, isNaN(hideAfter) ? defaultStatusMessageStyle.duration : hideAfter);
}

// Reset all objects' message styles to default
function resetAllMessageStyles() {
    for (const k in placedObjects) {
        if (placedObjects[k]) placedObjects[k].statusMessageStyle = { ...defaultStatusMessageStyle };
    }
}

// Game Over dialog

function showGameOver(text) {
    const dialog = document.getElementById('game-over-box');
    dialog.innerHTML = text;
    dialog.style.display = 'flex';
}

function youDied() {
    player.gameOver = true;
    gamePaused = true;
    showGameOver('<center>You Died<br><b style="font-size: 48px">Game Over</b></center>');
    cancelAnimationFrame(animateGame);
}

// #############################################
// ############ Collision detection ############
// #############################################

function getTileAtCanvasPosition(mouseX, mouseY) {
    // Assumes tileSizeX and tileSizeY are defined globally
    const tileX = Math.floor(mouseX / tileSizeX);
    const tileY = Math.floor(mouseY / tileSizeY);
    return { tileX, tileY };
}

function getObjectAtTile(tileX, tileY, layer = 1) {
    // Default to layer 1 if not specified
    const key = `${layer},${tileX},${tileY}`;
    return placedObjects[key] || null;
}

function jumpToLabel(obj, label) {
    // label should include the colon, e.g., ':click'
    if (!obj.labels || !obj.labels[label]) {
        console.warn(`Label ${label} not found in object script.`);
        return;
    }
    const index = resolveLabel(obj, label);
    if (index !== null) {
        obj.scriptIndex = index;
        obj.waitTime = 0;
        obj.waiting = false;
        obj.resting = false;
    }
}

function checkTiles(x, y, direction = 'down') {
    let leftTile = Math.floor(x / tileSizeX);
    let topTile = Math.floor(y / tileSizeY);
    let rightTile = Math.ceil((x + tileSizeX - 1) / tileSizeX) - 1;
    let bottomTile = Math.ceil((y + tileSizeY - 1) / tileSizeY) - 1;

    switch (direction) {
        case 'up':
            return [{ x: leftTile, y: topTile },
            { x: rightTile, y: topTile },];
        case 'down':
            return [{ x: leftTile, y: bottomTile },
            { x: rightTile, y: bottomTile },];
        case 'left':
            return [{ x: leftTile, y: topTile },
            { x: leftTile, y: bottomTile },];
        case 'right':
            return [{ x: rightTile, y: topTile },
            { x: rightTile, y: bottomTile },];
    }
}

function isOverlappingTile(object, tileX, tileY) {
    const tileLeft = tileX * tileSizeX;
    const tileTop = tileY * tileSizeY;
    const tileRight = tileLeft + tileSizeX;
    const tileBottom = tileTop + tileSizeY;

    const objLeft = object.x * tileSizeX;
    const objTop = object.y * tileSizeY;
    const objRight = objLeft + object.width;
    const objBottom = objTop + object.height;

    return !(objRight <= tileLeft ||
        objLeft >= tileRight ||
        objBottom <= tileTop ||
        objTop >= tileBottom);
}

function isBoundingBoxOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return (
        ax < bx + bw &&
        ax + aw > bx &&
        ay < by + bh &&
        ay + ah > by
    );
}

function isAlignedWithTile(object) {
    const epsilon = 0.01; // Small tolerance for floating-point precision
    const isAlignedX = Math.abs(object.x - Math.round(object.x)) < epsilon;
    const isAlignedY = Math.abs(object.y - Math.round(object.y)) < epsilon;
    return isAlignedX && isAlignedY;
}

function canMoveTo(x, y, object = player) {
    // Calculate the player's bounding box at the new position

    let playerLeft = x * tileSizeX;
    let playerTop = y * tileSizeY;
    let playerWidth = object.width || tileSizeX;
    let playerHeight = object.height || tileSizeY;
    if (object.type === 'bullet') {
        playerLeft = (x * tileSizeX) - object.width / 2;
        playerTop = (y * tileSizeY) - object.height / 2;
    }

    // --- Passage check: only for player, only at intended tile ---
    if (object.type === 'player') {
        const passageKey = `${object.layer},${Math.round(x)},${Math.round(y)}`;
        const isOnPassage = placedPassages[passageKey] && placedPassages[passageKey].type === 'passage';

        // Only trigger passage if:
        // 1. Player is aligned with the tile (centered)
        // 2. Player is NOT already fully overlapping the passage tile (prevents re-trigger)
        // 3. Player is moving ONTO the passage tile (not off)
        if (isOnPassage && isAlignedWithTile({ x, y })) {
            console.log('Player is on a passage tile:', passageKey);
            // Check if player was NOT already fully on this passage tile
            // (i.e., player.x/y before move is not the same as x/y after move)
            if (isOverlappingTile(object, Math.round(x), Math.round(y))) {
                object.locked = true; // Lock player movement
                let targetBoard = placedPassages[passageKey].data.board;
                let passageColor = placedPassages[passageKey].color;
                let colorKey = passageColor.join(',');
                console.log('Switching to board:', targetBoard, 'with colorKey:', colorKey);
                switchBoard(targetBoard, colorKey);
                return true; // Prevent movement (board switch will move player)
            }
            // If player is already fully on the passage tile, allow stepping off
            // (do NOT return false here, just continue to collision checks)
        }
    }

    // Check for collision with all placedSprites (except the player itself)
    for (const key in placedSprites) {
        const sprite = placedSprites[key];
        //if (sprite.type === 'player') continue; // Skip player sprite

        const [layer, objX, objY] = key.split(',').map(Number);

        // Only check collision if on the same layer
        if (layer !== object.layer) continue;

        if (sprite.id && object.id && sprite.id === object.id) continue; // Skip collision with itself

        const objLeft = objX * tileSizeX;
        const objTop = objY * tileSizeY;
        const objWidth = sprite.width || tileSizeX; // Use sprite width or default tile size
        const objHeight = sprite.height || tileSizeY;

        if (isBoundingBoxOverlap(
            playerLeft, playerTop, playerWidth, playerHeight,
            objLeft, objTop, objWidth, objHeight
        )) {

            if (sprite.type === 'object' && object.type === 'bullet') {
                handlePlayerInteraction(key, ":shot");
                return false; // Bullet stops here
            }
            // --- Handle bullet hitting player ---
            if (sprite.type === 'player' && object.type === 'bullet' && object.origin !== 'player') {
                console.log('Bullet hit player!');
                player.stats.health -= object.damage || 1; // Reduce player health
                player.flashRed = true;
                player.flashTimer = 200; // flash for 200ms
                if (player.stats.health <= 0) youDied(); // Check if player died
                return false; // Bullet stops here
            }

            // --- Handle player touching objects ---
            /*if (sprite.type === 'object' && object.type === 'player') {
                if (!player.justInteracted) {
                    handlePlayerInteraction(key, ":touch");
                }
                return false; // Block movement if you want the player to stop
            }*/

            if (sprite.type === 'object' && object.type === 'player') {
                const obj = placedObjects[key];
                if (obj) {
                    // Run :step or :collect immediately if present
                    if (obj.labels && (obj.labels[':step'] || obj.labels[':collect'])) {
                        if (obj.labels[':step']) runImmediateLabel(obj, ':step');
                        else runImmediateLabel(obj, ':collect');
                        // After running the label, if the object is gone, allow movement
                        if (!placedObjects[key]) return true;
                    } else if (!player.justInteracted) {
                        handlePlayerInteraction(key, ":touch");
                        if (!placedObjects[key]) return true;
                    }
                }
                return false;
            }

            /*if (sprite.type === 'object' && object.type === 'player') {
                const obj = placedObjects[key];
                if (obj) {
                    // Run :step or :collect immediately if present
                    if (obj.labels && (obj.labels[':step'] || obj.labels[':collect'])) {
                        if (obj.labels[':step']) runImmediateLabel(obj, ':step');
                        else runImmediateLabel(obj, ':collect');
                    } else if (!player.justInteracted) {
                        handlePlayerInteraction(key, ":touch");
                    }
                }
                return false;
            }*/
            if (sprite.type === 'sign' && object.type === 'player') {
                gamePaused = true; // Pause the game loop
                showDialog(placedSprites[key].data.script
                    .replace(/(?:\r\n|\r|\n)/g, '<br>'));
                return false; // Block movement while dialog is open
            }
            if (sprite.type === 'player' && object.type === 'object') {
                // Block object from moving into the player
                console.log('Object cannot move into player!');
                const objectKey = `${object.layer},${object.x},${object.y}`;
                handleObjectInteraction(objectKey, ":bump"); // Trigger bump interaction for the object bumping into player
                return false;
            }
            if ((sprite.type === 'coin' || sprite.type === 'ammo' || sprite.type === 'key') && object.type === 'object') {
                // Do Not allow object to collect or destroy coins, ammo, or keys
                return false; // Block object from collecting
            }
            if (sprite.type === 'break' && object.type === 'bullet') {
                // Destroy the break tile
                delete placedSprites[key];
                updateTile(layer, objX, objY);
                return false; // Bullet stops here
            }
            if ((sprite.type === 'coin' || sprite.type === 'ammo' || sprite.type === 'key' || sprite.type === 'step') && object.type === 'player') {
                if (sprite.type === 'coin') {
                    player.stats.coin += sprite.data?.value || 1;
                    console.log(`Collected coin. Total coins: ${player.stats.coin}`);
                }
                if (sprite.type === 'ammo') {
                    player.stats.ammo += sprite.data?.value || 1;
                    console.log(`Collected ammo. Total ammo: ${player.stats.ammo}`);
                }
                if (sprite.type === 'key') {
                    player.stats.keys += sprite.data?.value || 1;
                    console.log(`Collected key. Total keys: ${player.stats.keys}`);
                }
                delete placedSprites[key];
                updateTile(layer, objX, objY);
                renderLayersToMainCanvas();
                return true;
            }
            if (
                sprite.type === 'push' &&
                (object.type === 'player' || object.type === 'object' || object.type === 'bullet')
            ) {
                const success = tryPushTiles(objX, objY, object.direction, layer);
                if (success) return true;
                return false;
            }
            if (sprite.type === 'invisible' && object.type === 'bullet') {
                // Allow bullet to pass through invisible tiles
                return true; // Allow bullet to pass
            }
            if (sprite.type === 'wall' || sprite.type === 'object' || sprite.type === 'break' || sprite.type === 'sign' || sprite.type === 'invisible') {
                if (sprite.id && object.id && sprite.id === object.id) {
                    console.log('Skipping self-collision for object id:', object.id);
                    continue;
                } else {
                    //console.log('Blocking due to object collision:', { spriteId: sprite.id, objectId: object.id });
                    return false;
                }
                return false; // Block movement
            }
            // ...other logic...

        }
    }

    // Optionally: check for out-of-bounds
    if (
        playerLeft < 0 || playerTop < 0 ||
        playerLeft + playerWidth > tilesX * tileSizeX ||
        playerTop + playerHeight > tilesY * tileSizeY
    ) {
        return false;
    }

    return true; // No collision, movement allowed
}

function tryPushTiles(startX, startY, direction, layer) {
    let pushTiles = [];
    let x = startX;
    let y = startY;

    // Move in the specified direction and collect pushable tiles
    while (true) {
        let key = `${layer},${x},${y}`;
        let sprite = placedSprites[key];
        if (!sprite || sprite.type !== 'push') break;

        // Check pushType
        let pushType = (sprite.data && sprite.data.pushType) ? sprite.data.pushType : 'ANY';
        if (
            (pushType === 'EW' && !(direction === 'left' || direction === 'right')) ||
            (pushType === 'NS' && !(direction === 'up' || direction === 'down'))
        ) {
            // Block pushing in disallowed direction
            return false;
        }

        pushTiles.push({ x, y }); // Add to list of pushable tiles

        // Move to next tile in the same direction
        switch (direction) {
            case 'up': y -= 1; break;
            case 'down': y += 1; break;
            case 'left': x -= 1; break;
            case 'right': x += 1; break;
        }
    }

    // The last tile in pushTiles is the final pushable tile
    let lastTile = pushTiles[pushTiles.length - 1];
    let newX = lastTile.x;
    let newY = lastTile.y;

    // Check if there is space at the end to move everything
    switch (direction) {
        case 'up': newY -= 1; break;
        case 'down': newY += 1; break;
        case 'left': newX -= 1; break;
        case 'right': newX += 1; break;
    }

    // Prevent pushing into the player
    if (isOverlappingTile(player, newX, newY)) return false;

    // Prevent pushing off the board
    if (newX < 0 || newY < 0 || newX >= tilesX || newY >= tilesY) {
        return false;
    }

    // Prevent pushing into any object (moving or not)
    for (const objKey in placedObjects) {
        const obj = placedObjects[objKey];
        if (obj.type !== 'object') continue; // Only block for objects
        // Calculate object's bounding box
        const objLeft = obj.x * tileSizeX;
        const objTop = obj.y * tileSizeY;
        const objWidth = obj.width || tileSizeX;
        const objHeight = obj.height || tileSizeY;
        // Calculate push block's destination bounding box
        const pushLeft = newX * tileSizeX;
        const pushTop = newY * tileSizeY;
        const pushWidth = tileSizeX;
        const pushHeight = tileSizeY;
        if (isBoundingBoxOverlap(pushLeft, pushTop, pushWidth, pushHeight, objLeft, objTop, objWidth, objHeight)) {
            return false; // Blocked by object (even if not grid-aligned)
        }
    }
    let pushKey = `${layer},${newX},${newY}`;
    if (
        placedSprites[pushKey] ||
        (placedPassages && placedPassages[pushKey] && placedPassages[pushKey].type === 'passage')
    ) {
        return false; // Block pushing into passages or any occupied tile
    }

    // Move all pushable tiles forward
    for (let i = pushTiles.length - 1; i >= 0; i--) {
        let oldKey = `${layer},${pushTiles[i].x},${pushTiles[i].y}`;
        let newKey = `${layer},${pushTiles[i].x + (newX - lastTile.x)},${pushTiles[i].y + (newY - lastTile.y)}`;

        placedSprites[newKey] = placedSprites[oldKey]; // Move tile
        delete placedSprites[oldKey]; // Remove from old position

        updateTile(layer, pushTiles[i].x, pushTiles[i].y);
        updateTile(layer, pushTiles[i].x + (newX - lastTile.x), pushTiles[i].y + (newY - lastTile.y));

        //moveSpeed += i * 10; // move speed based on number of tiles pushed
    }

    return true; // Movement allowed
}

function tryPushPlayer(startX, startY, direction, layer) {
    let dx = 0, dy = 0;
    switch (direction) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
    }

    const newX = player.x + dx;
    const newY = player.y + dy;

    // Prevent pushing out of bounds
    if (newX < 0 || newY < 0 || newX >= tilesX || newY >= tilesY) return false;

    // Check if player is roughly aligned to the grid
    //const aligned = Math.abs(player.x - Math.round(player.x)) < 0.5 &&
    //                Math.abs(player.y - Math.round(player.y)) < 0.5;
    //if (!aligned) return false;

    // Check if the tile ahead is empty
    const tiles = checkTiles(newX * tileSizeX, newY * tileSizeY, direction)
    //console.log(tiles);
    for (let tile of tiles) {

        let tileKey = `${layer},${tile.x},${tile.y}`;

        if (placedSprites[tileKey]) {
            if (placedSprites[tileKey].type === 'push') {
                const success = tryPushTiles(tile.x, tile.y, direction, layer);
                if (!success) return false; // If push fails, don't push player
            } else {
                return false; // Something else is in the way
            }
        }
    }

    // Push the player
    player.x = newX;
    player.y = newY;

    for (const key in placedObjects) {
        if (placedObjects[key].pendingRemoval) {
            delete placedObjects[key];
            delete placedSprites[key];
            updateTile(...key.split(',').map(Number));
        }
    }

    return true;
}

// #########################################
// ############ Player movement ############
// #########################################

function updatePlayer(deltaTime) {
    accumulatedTime += deltaTime;
    if (accumulatedTime < moveSpeed) return; // Wait for the next frame
    accumulatedTime = 0;

    //let oldTiles = getOverlappingTiles(player.x * 32, player.y * 32);
    let newX = player.x;
    let newY = player.y;
    // old x and y?

    if (player.health === 0) youDied();

    switch (true) {
        case keys['ArrowUp'] && canMoveTo(player.x, player.y - stepSize):
            newY -= stepSize;
            break;
        case keys['ArrowDown'] && canMoveTo(player.x, player.y + stepSize):
            newY += stepSize;
            break;
        case keys['ArrowLeft'] && canMoveTo(player.x - stepSize, player.y):
            newX -= stepSize;
            break;
        case keys['ArrowRight'] && canMoveTo(player.x + stepSize, player.y):
            newX += stepSize;
            break;
    }

    if (newX !== player.x || newY !== player.y) {
        if (!player.transported) {
            const oldKey = `${player.layer},${player.x},${player.y}`;
            const newKey = `${player.layer},${newX},${newY}`;

            player.x = newX;
            player.y = newY;

            placedSprites[newKey] = placedSprites[oldKey];
            delete placedSprites[oldKey];
        }
        player.transported = false;
        player.justInteracted = false; // Reset the flag after moving

        renderLayersToMainCanvas();
    }
}

function movePlayer(newLayer, newX, newY) {
    // Remove player from old position
    const oldKey = `${player.layer},${player.x},${player.y}`;
    if (placedSprites[oldKey]) {
        delete placedSprites[oldKey];
    }

    // Update player object
    player.layer = newLayer;
    player.x = newX;
    player.y = newY;
    player.transported = true;

    // Add player to new position
    const newKey = `${newLayer},${newX},${newY}`;
    placedSprites[newKey] = { ...player, type: 'player' };

    renderLayersToMainCanvas();
}

// #############################################
// ######## Events & loading functions #########
// #############################################

// Load board and replace sprite sheet
function handleLoadedBoard(spriteSheetData, boardData) {
    deactivateAllBullets(bulletArray); // Deactivate all bullets

    placedSprites = boardData;

    replaceSpriteSheet(spriteSheetData);

    placedObjects = loadObjectsFromGameData(placedSprites);
    console.log('Loaded Board', placedSprites);

    loaded = true;
    player = findPlayerSprite();
    player = { ...playerStats, ...player };

    nightMode = false;
    // Hide dialog and game over boxes
    document.getElementById('dialog-box').style.display = 'none';
    document.getElementById('game-over-box').style.display = 'none';
    gamePaused = false;
    player.locked = false;
    // ...existing code...

    //stats = player.stats;
    console.log('Loaded Stats', playerStats);
    console.log(player);

    drawBoard(); // Generate all layers
    renderLayersToMainCanvas(); // Draw them onto the main canvas
}

function handleLoadedGame(spriteSheetData, boardList, worldData) {
    deactivateAllBullets(bulletArray); // Deactivate all bullets  
    boards = boardList; // Load the board list
    world = worldData; // Load the world data
    replaceSpriteSheet(spriteSheetData); // Load the sprite sheet data

    // Helper to get board name from boards array
    function getBoardName(boardNum) {
        const entry = boards.find(b => b[0] === Number(boardNum));
        return entry ? entry[1] : `Board ${boardNum}`;
    }

    // Extract passages and objects for all boards
    for (const board in world) {
        loadPassagesFromGameData(world[board], board);
        worldObjects[board] = loadObjectsFromGameData(world[board]);

        boardData[board] = {
            playerStart: (() => {
                for (const key in world[board]) {
                    if (world[board][key].type === 'player') {
                        const [layer, x, y] = key.split(',').map(Number);
                        return { layer, x, y };
                    }
                }
                return null;
            })(),
            name: getBoardName(board), // Use the name from boards array
            light: world[board].light !== undefined ? world[board].light : true,
            nightMode: world[board].nightMode !== undefined ? world[board].nightMode : false,
            // Add more board-specific properties as needed
        };
    }

    console.log('Loaded world data:', worldData);
    console.log('Loaded world objects:', worldObjects);

    currentBoard = 2;
    placedSprites = world[currentBoard]; // Get the current board from the world object
    placedObjects = worldObjects[currentBoard]; // Get objects for the current board
    placedPassages = worldPassages[currentBoard] || {}; // Load passages for the current board
    Object.keys(spriteCache).forEach(key => delete spriteCache[key]); // Safe clear sprite cache
    hiddenLayers.clear(); // Clear hidden layers

    loaded = true;
    player = findPlayerSprite();
    playerStats = structuredClone(defaultPlayerStats); // Reset player stats
    player = { ...playerStats, ...player };
    nightMode = false;
    gamePaused = false;
    player.locked = false;
    player.gameOver = false; // Reset game over state

    // Hide dialog and game over boxes
    document.getElementById('dialog-box').style.display = 'none';
    document.getElementById('game-over-box').style.display = 'none';
    canvas.focus(); // Ensure canvas is focused for input

    console.log('Loaded World');
    drawBoard();
    renderLayersToMainCanvas(); // Draw them onto the main canvas
    requestAnimationFrame(animateGame);
}

function loadPassagesFromGameData(gameData, board) {
    //if (!worldPassages[board]) {
    worldPassages[board] = {}; // Initialize storage for the board if it doesn't exist
    //}

    for (const key in gameData) {
        const sprite = gameData[key];
        if (sprite.type === 'passage') {
            const [layer, x, y] = key.split(',').map(Number); // Extract layer, x, y from the key
            worldPassages[board][`${layer},${x},${y}`] = sprite; // Store passage data for the board
            console.log('Loaded passage:', { board, key, sprite });
        }
    }

    return worldPassages[board]; // Return the passages for the current board
}

function switchBoard(board, colorKey) {
    deactivateAllBullets(bulletArray); // Deactivate all bullets

    placedSprites = world[board]; // Get the current board from the world object
    placedObjects = worldObjects[board]; // Use preloaded objects
    placedPassages = worldPassages[board] || {}; // Load passages for the current board

    let foundPassage = false;

    // Lookup passage color in placedPassages for a match
    for (const key in placedPassages) {
        const passage = placedPassages[key];
        const passageColorKey = passage.color.join(','); // Create a unique key for the passage color

        if (passageColorKey === colorKey) { // Compare the color keys
            const [layer, x, y] = key.split(',').map(Number); // Extract layer, x, y from the key
            movePlayer(layer, x, y); // Use movePlayer to update the player's position
            foundPassage = true;
            break; // Exit loop after finding the first match
        }
    }

    // If no matching passage found, use playerStart from boardData
    if (!foundPassage) {
        const start = boardData[board]?.playerStart;
        if (start) {
            movePlayer(start.layer, start.x, start.y);
        } else {
            // Fallback: try to find the player sprite on the board
            let playerSprite = findPlayerSprite();
            if (playerSprite) {
                movePlayer(playerSprite.layer, playerSprite.x, playerSprite.y);
            } else {
                console.warn('No player start position found for board', board);
            }
        }
    }

    player.locked = false; // Unlock player movement

    currentBoard = board;
    drawBoard();
    renderLayersToMainCanvas(); // Draw them onto the main canvas
}

function findPlayerSprite() {
    for (const key in placedSprites) {
        const sprite = placedSprites[key];
        if (sprite.type === 'player') {
            const [layer, x, y] = key.split(',').map(Number); // Extract layer, x, y from the key
            return { layer, x, y, ...sprite }; // Return sprite with position data
        }
    }
    return null; // Return null if no player is found
}

// Key mapping (now using key names instead of key codes)
let util = { Tab: "tab", Enter: "enter", Shift: "shift", Alt: "alt", Escape: "esc", PageUp: "rePag", PageDown: "avPag", End: "end", Home: "home", ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", F1: "F1", F2: "F2", F3: "F3", F4: "F4", F6: "F6", F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12" };

document.addEventListener("keydown", (event) => {
    keys[event.key] = true;

    var key = event.code; // Use event.code
    if (util[key]) {
        event.preventDefault();
    }
    //console.log(event.key, event.code); // Debugging
    if (event.key === 'F3') { // loading whole worlds
        loadWorld(handleLoadedGame);
    }

    // Block all other keys if not loaded
    if (!loaded) return;

    if (!player.locked) { // Prevent input if player is locked

        if (event.key === 'l' && !gamePaused) { // load game
            loadCombinedData(handleLoadedBoard);
        }

        if (event.key === 'r') {
            drawBoard(); // Generate all layers
            renderLayersToMainCanvas(); // Draw them onto the main canvas
        }

        if (event.key === 'p') {
            if (!gamePaused) {
                playerPaused = !playerPaused;
                if (!playerPaused) {
                    requestAnimationFrame(animateGame);
                }
                // Optionally show/hide your pause UI here
            }
            //gamePaused = !gamePaused;
            //if (!gamePaused) requestAnimationFrame(animateGame);
        }

        if (event.key === ' ' && !gamePaused) { // Space bar to shoot
            bulletArray.push(createBullet(canvas, player.x + 0.5, player.y + 0.5, player.direction));
        }

        if (event.key === 'n') { // M to toggle night mode (TEMPORARY)
            nightMode = !nightMode;
            renderLayersToMainCanvas(); // Redraw layers to apply night mode
        }
    }

    if (event.key === 'f') { // show player location
        console.log('Placed sprites:', placedSprites);
        console.log('Player location:', player.layer, player.x, player.y);
        console.log('Player stats:', player.stats);
        console.log('Bullets active:', bulletArray.filter(b => b.active));
    }

    updateDirection(); // Update direction based on keys held
});

document.addEventListener('keyup', (event) => {
    if (!loaded) return; // Ignore input if game not loaded
    keys[event.key] = false;
    updateDirection(); // Update direction when key is released
    if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
    ) {
        player.justInteracted = false;
    }
});

// Function to determine the correct direction
function updateDirection() {
    if (keys['ArrowUp']) {
        player.direction = 'up';
    } else if (keys['ArrowDown']) {
        player.direction = 'down';
    } else if (keys['ArrowLeft']) {
        player.direction = 'left';
    } else if (keys['ArrowRight']) {
        player.direction = 'right';
    }
}

// Start the animation
//requestAnimationFrame(animateGame);
drawDefaultTitleScreen()