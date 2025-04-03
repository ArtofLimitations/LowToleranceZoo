import { loadCombinedData } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, drawPlayerSprite, drawSpriteImage, getSprite } from './sprite.js';
import { createBullet } from './weapons.js';
import { playerStats } from './player-stats.js';
import { extractRGB, namedColors, loadObjectsFromGameData } from './object-functions.js';
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
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false

// Game configurations
let placedSprites = {};
const tileSizeX = 32;                // Single tile size
const tileSizeY = 32;
const tilesX = 36;                   // Board width and height
const tilesY = 25;
const hiddenLayers = new Set();      // Set to hold hidden layers
const keys = {};                     // Hold key states
const tilesCanvas = new OffscreenCanvas(4 * tileSizeX, 4 * tileSizeY);
const tilesCtx = tilesCanvas.getContext('2d');
const layerCanvases = {};            // Stores canvases for layers
const layerContexts = {};            // Stores 2D contexts for layers
let placedObjects = {};              // Stores objects on the board
//const namedColors = namedColorList;  // Named colors for easy reference

// board variables
let board = {};
let loaded = false;
let nightMode = true;

// Player
let player = playerStats;
let stats = player.stats;
const stepSize = player.stepSize; // Step size for player movement
let gamePaused = false;
let bulletArray = [];

// File info
export let filename = ''; // ############ File to load ###############

// Timing
let fps = 60;
let lastTime = 0;   // Timing variables
let moveSpeed = 80; // Pixels per second
let accumulatedTime = 0;

// #################################################
// ############ Main animation function ############
// #################################################

export function animateGame(currentTime) {
    if (gamePaused) return; // Stop the loop when the game is paused

    const deltaTime = currentTime - lastTime;

    if (deltaTime > 1000 / fps) { // 60 FPS cap
        // Update the position based on the speed and deltaTime
        lastTime = currentTime;

        //position += speed * (deltaTime / 1000) * 60;
        updateBullets();
        updateObjects(deltaTime);
        updatePlayer(deltaTime);

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
            .filter(sprite => sprite.l === layer) // Get only sprites for this layer
            .forEach(sprite => {
                if (sprite.type !== 'player') drawSpriteToCanvas(ctx, sprite.x, sprite.y, tileSizeX, tileSizeY, sprite.sprite, sprite.color);
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
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the main canvas
    const sortedLayers = [1, 2, 3];

    for (const layer of sortedLayers) {
        if (layerCanvases[layer]) {

            ctx.save()
            //if (layer === 3) ctx.filter = 'opacity(0.8)';
            //if (layer === 2) ctx.filter = 'blur(1px)';
            //if (layer === 3) ctx.globalCompositeOperation = "destination-over";
            ctx.drawImage(layerCanvases[layer], 0, 0);
            ctx.restore();

        } else {
            console.warn(`Layer ${layer} is missing!`); // Debugging
        }
        if (layer === player.layer) {
            //console.log(player);
            ctx.save();
            ctx.shadowColor = "white";
            ctx.shadowBlur = 10;
            ctx.drawImage(getSprite(player.sprite, player.color), player.x * tileSizeX, player.y * tileSizeY);

            bulletArray.forEach(bullet => {
                bullet.draw();
            });
            ctx.restore();
        }
    }
    if (nightMode) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = 'rgba(0, 0, 0, .7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}

function drawSpriteToCanvas(ctx, x, y, tileSizeX, tileSizeY, sprite, color) {
    drawSprite(x, y, tileSizeX, tileSizeY, sprite, color, ctx); // Draw sprite on given canvas
}

function clearTile(x, y) {
    ctx.clearRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY);
}

// ##########################################
// ############ Object functions ############
// ##########################################

function updateObjects(deltaTime) {

    for (let key in placedObjects) {
        let obj = placedObjects[key];

        // Handle waiting state
        if (obj.waiting) {
            obj.waitTime--;
            if (obj.waitTime <= 0) {
                obj.waiting = false; // Done waiting
            }
            continue; // Skip executing new commands
        }

        obj.timeSinceLastMove += deltaTime;
        if (obj.timeSinceLastMove >= obj.moveInterval) {

            if (obj.resting) continue; // Skip if object is resting

            let command = obj.script[obj.scriptIndex].split(' ');
            let action = command[0];
            let args = command.slice(1);

            if (command[0].startsWith('@')) {
                obj.name = command[0].substring(1); // Set name
                obj.scriptIndex++;
                continue; // Skip to next command
            }

            executeObjectCommand(obj, action, args);

            // Move script index only if not waiting
            //if (!obj.waiting) {
            obj.scriptIndex++;
            //}

            if (command[0] === "#loop") {
                if (obj.labels[":loop"] !== undefined) {
                    obj.scriptIndex = obj.labels[":loop"]; // Jump to label position
                } else {
                    console.error("Error: Missing ':loop' label in script.");
                }
                return;
            }

            // Auto-stop if script ends without `#end`
            if (obj.scriptIndex >= obj.script.length) {
                obj.resting = true;
            }

            obj.timeSinceLastMove = 0;

            renderLayersToMainCanvas();
        }
    }
}

function executeObjectCommand(obj, action, args) {
    switch (action) {
        case '#end':
            obj.resting = true;
            break;
        //case `@${action}`:
        //obj.name = args.join(" ");
        //break;
        case "#text":
            gamePaused = true; // Pause the game loop
            showDialog(args.join(" "));
            break;
        case "#change":
            let spriteNumber = parseInt(args[0], 10);
            let dark, light;

            // Detect if colors are RGB or named
            if (args[1].startsWith("(")) {
                // RGB format: Extract two sets of RGB values
                dark = extractRGB(args.slice(1, 4).join(" "));
                light = extractRGB(args.slice(4, 7).join(" "));
            } else {
                // Named colors
                dark = namedColors[args[1]] || [0, 0, 0]; // Default to black if not found
                light = namedColors[args[2]] || [255, 255, 255]; // Default to white if not found
            }

            // Apply sprite change
            obj.sprite = spriteNumber;
            obj.color = [dark, light];

            placedSprites[`${obj.layer},${obj.x},${obj.y}`].sprite = spriteNumber;
            placedSprites[`${obj.layer},${obj.x},${obj.y}`].color = [dark, light];
            updateTile(obj.layer, obj.x, obj.y); // Update tile with new sprite
            renderLayersToMainCanvas(); // Ensure visual update

            break;
        case '#changecolor':
            if (args[0] === "undefined") { console.warn("No color provided"); return; }
            let color = extractRGB(args[0]); // Extract RGB values
            let spriteKey = `${obj.layer},${obj.x},${obj.y}`;
            if (placedSprites[spriteKey]) {
                placedSprites[spriteKey].color = color; // Update color
                updateTile(obj.layer, obj.x, obj.y); // Update tile with new color
                renderLayersToMainCanvas(); // Ensure visual update
            }
            break;
        case '#changesprite':
            if (args[0] === "undefined" || isNaN(args[0])) { console.warn("No sprite provided or NaN"); return; }
            let spriteKeyChange = `${obj.layer},${obj.x},${obj.y}`;
            if (placedSprites[spriteKeyChange]) {
                placedSprites[spriteKeyChange].sprite = parseInt(args[0], 10); // Update sprite
                updateTile(obj.layer, obj.x, obj.y); // Update tile with new sprite
                renderLayersToMainCanvas(); // Ensure visual update
            }
            break;
        case "#timer":
            obj.timer = parseInt(args[0], 10); // Set timer
            break;
        case "#move":
            let direction = args[0];
            switch (args[0]) {
                case 'north': direction = 'up'; break;
                case 'south': direction = 'down'; break;
                case 'east': direction = 'right'; break;
                case 'west': direction = 'left'; break;
            }
            moveObject(obj, direction, obj.layer);
            break;
        case '#shoot':
            if (args[0] === "undefined") { console.warn("No direction provided"); return; }
            if (args[0] === 'seek') {
                // Implement seeking logic here
                console.warn("Seeking bullets not implemented yet");
                return;
            }
            let bullet = createBullet(canvas, obj.x, obj.y, args[0], 16, 'white', 'object');
            bulletArray.push(bullet);
            break;
        case "#wait":
            obj.waiting = true; // Set waiting state
            obj.waitTime = parseInt(args[0], 10); // Store remaining cycles
            break;
        case "#loop":
            obj.scriptIndex = obj.labels[":loop"] || 0;
            break;
        case '#nightmode':
            nightMode = !nightMode;
            break;
        default:
            console.warn(`Unknown command: ${action}`);
    }
}

/*/ Helper function to extract RGB values
function extractRGB(str) {
    let match = str.match(/\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+(\.\d+)?)?\)/); // Capture RGB, ignore alpha
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 1] : [0, 0, 0, 1]; // Default to black with full alpha
}

// Named color lookup table
const namedColors = {
    "red": [255, 0, 0, 255],
    "pink": [255, 182, 193, 255],
    "blue": [0, 0, 255, 255],
    "green": [0, 255, 0, 255],
    "yellow": [255, 255, 0, 255],
    "purple": [128, 0, 128, 255],
    "orange": [255, 165, 0, 255],
    "white": [255, 255, 255, 255],
    "black": [0, 0, 0, 255]
};*/

function moveObject(obj, direction, layer) {
    const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    if (!offsets[direction]) {
        console.warn(`Invalid direction: ${direction} for #move`);
        return; // Invalid direction guard
    }

    const [dx, dy] = offsets[direction];
    const [newX, newY] = [obj.x + dx, obj.y + dy];

    const oldKey = `${layer},${obj.x},${obj.y}`;
    const newKey = `${layer},${newX},${newY}`;

    if (placedObjects[newKey]) return; // Prevent movement if occupied

    placedSprites[newKey] = placedSprites[oldKey]; // Move sprite
    placedObjects[newKey] = obj;

    delete placedObjects[oldKey];
    delete placedSprites[oldKey];

    updateTile(layer, obj.x, obj.y); // Clear old tile

    obj.x = newX;
    obj.y = newY;

    updateTile(layer, obj.x, obj.y); // Update new tile
}

/*
function loadObjectsFromGameData() {
    placedObjects = {}; // Reset objects

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
} */

function handleObjectTouch(tileKey) {
    let obj = placedObjects[tileKey];
    if (obj && obj.labels[":touch"]) {
        obj.scriptIndex = obj.labels[":touch"];
        obj.resting = false; // Wake up the object
    }
}

// ##############################################
// ############ Dialog box functions ############
// ##############################################

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

function showDialog(text, object = null) { // Show dialog box with text
    let pages = paginateText(text, 200); // Adjust maxLength as needed
    let pageIndex = 0;
    const dialog = document.getElementById('dialog-box');

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

    setTimeout(() => inputBlocked = false, 300); // Block input for 1000ms

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

// #############################################
// ############ Collision detection ############
// #############################################

function getOverlappingTiles(x, y) {
    let leftTile = Math.floor(x / 32);
    let topTile = Math.floor(y / 32);
    let rightTile = Math.floor((x + 31) / 32);
    let bottomTile = Math.floor((y + 31) / 32);

    return [
        { x: leftTile, y: topTile },
        { x: rightTile, y: topTile },
        { x: leftTile, y: bottomTile },
        { x: rightTile, y: bottomTile }
    ];
}

function checkTiles(x, y, direction) {
    let leftTile = Math.floor(x / tileSizeX);
    let topTile = Math.floor(y / tileSizeY);
    let rightTile = Math.ceil((x + tileSizeX - 1) / tileSizeX) - 1;
    let bottomTile = Math.ceil((y + tileSizeY - 1) / tileSizeY) - 1;

    switch (direction) {
        case 'up':
        case 'north':
            return [{ x: leftTile, y: topTile },
            { x: rightTile, y: topTile },];
        case 'south':
        case 'down':
            return [{ x: leftTile, y: bottomTile },
            { x: rightTile, y: bottomTile },];
        case 'west':
        case 'left':
            return [{ x: leftTile, y: topTile },
            { x: leftTile, y: bottomTile },];
        case 'east':
        case 'right':
            return [{ x: rightTile, y: topTile },
            { x: rightTile, y: bottomTile },];
    }
}

function canMoveTo(x, y, object = player) {
    if (object.type === 'bullet') {
        x = x - 0.5;
        y = y - 0.5;
    }

    let tiles = checkTiles(x * tileSizeX, y * tileSizeY, object.direction);

    for (let tile of tiles) {
        let tileKey = `${object.layer},${tile.x},${tile.y}`;

        if (tile.x < 0 || tile.y < 0 || tile.y >= tilesY || tile.x >= tilesX) {
            return false; // Out of bounds = collision
        }

        if (placedSprites[tileKey]) {
            let tileType = placedSprites[tileKey].type;

            //if (object === 'bullet' && tileType === 'object' && object.origin === 'object') return true; 

            // Collision with walls or unbreakable objects
            if (tileType === 'wall' || tileType === 'break' || tileType === 'sign' || tileType === 'object') {
                // If it's a bullet hitting a breakable tile
                if (object.type === 'bullet' && tileType === 'break') {
                    delete placedSprites[tileKey];
                    updateTile(object.layer, tile.x, tile.y);
                }
                // if it's a sign, show script
                if (tileType === 'sign' && object.type === 'player') {
                    gamePaused = true; // Pause the game loop
                    //dialogBox(placedSprites[tileKey].data.script
                    //.replace(/(?:\r\n|\r|\n)/g, '<br>'));
                    showDialog(placedSprites[tileKey].data.script
                        .replace(/(?:\r\n|\r|\n)/g, '<br>'));
                }

                if (tileType === 'object' && object.type === 'player') {
                    handleObjectTouch(tileKey);
                }
                
                return false;
            }

            // Picking up an item or destroying tile
            if (tileType === 'item' && object.type === 'player') {
                stats.coins++;
                console.log('Coins:', stats.coins);
                delete placedSprites[tileKey];
                updateTile(player.layer, tile.x, tile.y);
                return true;
            }

            // If it's a pushable block
            if (tileType === 'push') {
                return tryPushTiles(tile.x, tile.y, object.direction, object.layer);

            }
        }
    }

    return true;
}

function tryPushTiles(startX, startY, direction, layer) {
    let pushTiles = [];
    let x = startX;
    let y = startY;

    // Move in the specified direction and collect pushable tiles
    while (true) {
        let key = `${layer},${x},${y}`;
        if (!placedSprites[key] || placedSprites[key].type !== 'push') break;

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

    let pushKey = `${layer},${newX},${newY}`;
    if (placedSprites[pushKey]) {
        return false; // If blocked, return false (don't push)
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
        const oldKey = `${player.layer},${player.x},${player.y}`;
        const newKey = `${player.layer},${newX},${newY}`;

        player.x = newX;
        player.y = newY;

        //let newTiles = getOverlappingTiles(player.x * 32, player.y * 32);

        //let uniqueTiles = [...new Set([...oldTiles, ...newTiles])];

        placedSprites[newKey] = placedSprites[oldKey];
        delete placedSprites[oldKey];

        renderLayersToMainCanvas();  
    }
}

// #############################################
// ######## Events & loading functions #########
// #############################################

// Load board and replace spritesheet
function handleLoadedGame(spriteSheetData, boardData) {

    placedSprites = boardData;

    replaceSpriteSheet(spriteSheetData);

    placedObjects = loadObjectsFromGameData(placedSprites);
    console.log('Loaded Board', placedSprites);

    loaded = true;
    player = findPlayerSprite();

    stats = { // update this. loads with board / player stats
        coins: 0,
        score: 0,
        lives: 3
    };

    console.log(player);

    drawBoard(); // Generate all layers
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
let util = { Tab: "tab", Enter: "enter", Shift: "shift", Alt: "alt", Escape: "esc", PageUp: "rePag", PageDown: "avPag", End: "end", Home: "home", ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6", F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12" };

document.addEventListener("keydown", (event) => {
    keys[event.key] = true;

    var key = event.code; // Use event.code
    if (util[key]) {
        event.preventDefault();
    }

    /*if (gamePaused && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) {
        document.getElementById('dialog-box').style.display = 'none';
        gamePaused = false; // Resume the game loop
        requestAnimationFrame(animateGame);
        return;
    }*/

    if (event.key === 'l' && !gamePaused) { // load game
        loadCombinedData(handleLoadedGame);
    }

    if (event.key === 'r') {
        drawBoard(); // Generate all layers
        renderLayersToMainCanvas(); // Draw them onto the main canvas
    }

    if (event.key === 'p') {
        gamePaused = !gamePaused;
        if (!gamePaused) requestAnimationFrame(animateGame);
    }

    if (event.key === ' ' && !gamePaused) { // Spacebar to shoot
        bulletArray.push(createBullet(canvas, player.x + 0.5, player.y + 0.5, player.direction));
    }

    updateDirection(); // Update direction based on keys held
});

document.addEventListener('keyup', (event) => {
    keys[event.key] = false;
    updateDirection(); // Update direction when key is released
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
requestAnimationFrame(animateGame);