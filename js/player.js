import { loadCombinedData, loadWorld } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, drawPlayerSprite, drawSpriteImage, getSprite } from './sprite.js';
import { createBullet, deactivateAllBullets } from './weapons.js';
import { defaultPlayerStats } from './player-stats.js';
import { calculateSeekDirection, extractRGB, namedColors, loadObjectsFromGameData, resolveLabel, convertDirections, takeStat, giveStat, calculateBulletPosition } from './object-functions.js';
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
let placedPassages = {};             // Stores passages on the board

//const namedColors = namedColorList;  // Named colors for easy reference

// board variables
let currentBoard = 2;                // Current board number
let boards = {};
let loaded = false;
let nightMode = true;
let currentCollisionGrid = null; // Current collision grid

// World variables
let world = {}; // World object
let worldObjects = {}; // Stores objects for all boards
let worldPassages = {}; // Stores passages for all boards
let collisionGrids = {}; // Stores collision grids for all boards

// Player
let player = structuredClone(defaultPlayerStats); // Player object
let playerStats = structuredClone(defaultPlayerStats);
let showPlayer = false; // Show player - debugging //let stats = playerStats;
const stepSize = player.stepSize; // Step size for player movement
let bulletArray = [];
let gamePaused = false;

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
        updatePlayer(deltaTime);
        updateObjects(deltaTime);
        updateBullets();

        if (loaded) renderLayersToMainCanvas();
    }

    // Loop the animation
    requestAnimationFrame(animateGame);
}

// ############ End of main animation function ############ 

// #################################################
// ######### Game initialization function ##########
// #################################################

function initializeCollisionGrid(canvasWidth, canvasHeight, numLayers = 3) {
    const gridWidth = Math.ceil(canvasWidth / 16); // Divide canvas width by 16
    const gridHeight = Math.ceil(canvasHeight / 16); // Divide canvas height by 16

    return {
        layers: Array.from({ length: numLayers }, () =>
            Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0)) // Initialize 2D array with 0
        ),
        width: gridWidth,
        height: gridHeight
    };
}

function initializeBoardCollisionGrids(boards, canvasWidth, canvasHeight, numLayers = 3) {
    const collisionGrids = {};

    for (const board in boards) {
        collisionGrids[board] = initializeCollisionGrid(canvasWidth, canvasHeight, numLayers);
    }

    return collisionGrids;
}

function populateCollisionGrid(collisionGrid, placedSprites) {
    // Clear the collision grid first
    for (let layer = 0; layer < collisionGrid.layers.length; layer++) {
        for (let y = 0; y < collisionGrid.height; y++) {
            for (let x = 0; x < collisionGrid.width; x++) {
                collisionGrid.layers[layer][y][x] = 0; // Reset to no collision
            }
        }
    }

    // Populate the collision grid based on placedSprites
    for (const key in placedSprites) {
        const sprite = placedSprites[key];
        const [layer, x, y] = key.split(',').map(Number);

        // Mark all 4 cells occupied by the 32x32 sprite
        for (let offsetY = 0; offsetY < 2; offsetY++) {
            for (let offsetX = 0; offsetX < 2; offsetX++) {
                const gridX = x * 2 + offsetX; // Convert 32x32 to 16x16 grid
                const gridY = y * 2 + offsetY;

                //console.log(`Populating collision grid at layer ${layer}, x: ${gridX}, y: ${gridY} for sprite type: ${sprite.type}`);

                if (sprite.type === 'wall' || sprite.type === 'break' || sprite.type === 'door') {
                    collisionGrid.layers[layer - 1][gridY][gridX] = 1; // Mark as a blocking tile
                } else if (sprite.type === 'push') {
                    collisionGrid.layers[layer - 1][gridY][gridX] = 2; // Mark as a pushable tile
                } else if (sprite.type === 'step' || sprite.type === 'coin' || sprite.type === 'ammo' || sprite.type === 'key') {
                    collisionGrid.layers[layer - 1][gridY][gridX] = 3; // Mark as a stepping tile
                } else if (sprite.type === 'invisible') {
                    collisionGrid.layers[layer - 1][gridY][gridX] = 4; // Mark as an invisible tile
                } else if (sprite.type === 'sign' || sprite.type === 'object') {
                    collisionGrid.layers[layer - 1][gridY][gridX] = 5; // Mark as a sign or object
                } else if (sprite.type === 'player') {
                    collisionGrid.layers[layer - 1][gridY][gridX] = 9; // Mark as player
                } else {
                    collisionGrid.layers[layer - 1][gridY][gridX] = 0; // No collision
                }
            }
        }
    }

    console.log('Collision grid populated:', collisionGrid);
}

function updateGrid(collisionGrid, layer, x, y, value) {
    // Update all 4 cells in the finer 16x16 grid for the 32x32 sprite
    for (let offsetY = 0; offsetY < 2; offsetY++) {
        for (let offsetX = 0; offsetX < 2; offsetX++) {
            //const gridX = Math.floor(x * 2) + offsetX; // Convert to 16x16 grid
            //const gridY = Math.floor(y * 2) + offsetY;
            const gridX = x * 2 + offsetX; // Convert to 16x16 grid
            const gridY = y * 2 + offsetY;
            collisionGrid.layers[layer][gridY][gridX] = value; // Set the new value
            //console.log(`Grid updated at layer=${layer}, gridX=${x * 2 + offsetX}, gridY=${y * 2 + offsetY}, value=${value}`);
        }
    }
}

function updatePlayerInGrid(collisionGrid, layer, x, y, value) {
    // Update all 4 cells in the finer 16x16 grid for the 32x32 player sprite
    for (let offsetY = 0; offsetY < 2; offsetY++) {
        for (let offsetX = 0; offsetX < 2; offsetX++) {
            const gridX = x * 2 + offsetX; // Convert to 16x16 grid
            const gridY = y * 2 + offsetY;
            collisionGrid.layers[layer][gridY][gridX] = value; // Set the new value
            //console.log(`Grid updated at layer=${layer}, gridX=${x * 2 + offsetX}, gridY=${y * 2 + offsetY}, value=${value}`);
        }
    }
}

function canMoveTo(x, y, object = player) {
    const grid = currentCollisionGrid
    // Convert 32x32 coordinates to 16x16 grid coordinates
    // Determine the grid area to check based on the object type
    let gridLeft, gridTop, gridRight, gridBottom;

    if (object.type === 'bullet') {
        // For bullets, use a smaller collision area
        const bulletSize = 8; // Bullet collision area (8x8)
        gridLeft = Math.floor((x * 32 - bulletSize / 2) * 2 / 32); // Convert to 16x16 grid
        gridTop = Math.floor((y * 32 - bulletSize / 2) * 2 / 32);
        gridRight = Math.floor((x * 32 + bulletSize / 2) * 2 / 32);
        gridBottom = Math.floor((y * 32 + bulletSize / 2) * 2 / 32);
    } else {
        // For other objects, use the full tile size
        gridLeft = Math.floor(x * 2); // Multiply by 2 for finer grid
        gridTop = Math.floor(y * 2);
        gridRight = Math.floor((x + 1) * 2) - 1; // Include the right edge
        gridBottom = Math.floor((y + 1) * 2) - 1; // Include the bottom edge
        //gridLeft = x * 2; // Multiply by 2 for finer grid
        //gridTop = y * 2;
        //gridRight = (x + 1) * 2 - 1; // Include the right edge
        //gridBottom = (y + 1) * 2 - 1; // Include the bottom edge
    }

    // Ensure the object has a valid layer
    const layer = object.layer - 1 || 0; // Default to layer 0 if not specified

    /*if (object.type === 'player') {
        console.log(`Checking collision for player on layer ${layer}`);
        console.log(`Checking tiles from (${gridLeft}, ${gridTop}) to (${gridRight}, ${gridBottom})`);
    }*/

    // Check all tiles that the sprite overlaps
    for (let gridY = gridTop; gridY <= gridBottom; gridY++) {
        for (let gridX = gridLeft; gridX <= gridRight; gridX++) {
            // Check bounds
            if (gridX < 0 || gridY < 0 || gridX >= grid.width || gridY >= grid.height) {
                return false; // Out of bounds
            }

            // Check for collisions in the specified layer
            const tileValue = grid.layers[layer][gridY][gridX];
            // Convert gridX and gridY (16x16) to spriteX and spriteY (32x32)
            const spriteX = Math.floor(gridX / 2);
            const spriteY = Math.floor(gridY / 2);

            const spriteKey = `${layer + 1},${spriteX},${spriteY}`;

            switch (tileValue) {
                case 0:
                    continue; // No collision
                case 1:
                    if (object.type === 'bullet') {
                        if (spriteKey in placedSprites) {
                            const sprite = placedSprites[spriteKey];
                            if (sprite.type === 'break') {
                                object.active = false; // Deactivate the bullet
                                delete placedSprites[spriteKey]; // Remove the sprite
                                updateGrid(grid, layer, spriteX, spriteY, 0); // Update the grid
                                updateTile(layer + 1, spriteX, spriteY); // Update the tile visually
                                renderLayersToMainCanvas(); // Redraw the canvas
                            }
                        }
                    }
                    return false; // Blocked by wall
                case 2:
                    // Handle pushable object logic here
                    return tryPushTiles(gridX / 2, gridY / 2, object.direction, layer + 1);
                case 3:
                    // Handle interactive tiles (e.g., coins, ammo, keys)
                    if (object.type === 'bullet') continue; // Ignore bullets
                    if (object.type === 'object') return false; // Block other objects
                    handleInteractiveTile(gridX, gridY, layer);
                    continue; // Stepping tile
                case 4:
                    if (object.type === 'bullet') continue; // Invisible tile does not block bullets
                    else return false; // Block other objects
                case 5:
                    // Handle special interaction tiles (e.g., signs, objects)
                    //const targetObject = placedObjects[spriteKey];
                    const targetObject = placedObjects[`${layer + 1},${Math.floor(x)},${Math.floor(y)}`];
                    // Handle collision with an object.
                    if (targetObject) {
                        if (object.type === 'object' && object.id === targetObject.id) {
                            console.log('Collision with object:', targetObject.id); // debugging
                            continue; // Ignore self-collision
                        }

                        if (object.type === 'bullet' && object.origin === targetObject.id) {
                            console.log('Bullet hit its own object:', targetObject.id); // debugging
                            continue; // Ignore bullets fired by the same object
                        }
                    }
                    /*if (object.type === 'bullet') {
                        const targetObject = placedObjects[`${layer},${Math.floor(x)},${Math.floor(y)}`];
                        if (targetObject && object.origin === targetObject.id) {
                            continue; // Ignore bullets fired by the same object
                        }
                    }*/
                    handleSpecialTile(gridX, gridY, layer, object);
                    return false; // Block other objects
                case 9:
                    // Handle collision with the player
                    if (object.type === 'player') continue; // Ignore player collision with itself    
                    if (object.type === 'bullet') {
                        // Prevent the player from shooting themselves
                        if (object.origin === 'player') {
                            continue; // Ignore bullets fired by the player
                        }

                        // Bullet hits the player
                        console.log('Bullet hit the player!');
                        player.stats.health -= object.damage || 1; // Reduce player's health
                        if (player.stats.health <= 0) {
                            youDied(); // Trigger game over
                        }
                        return false; // Block further movement for the bullet
                    }
                    return handleObjectCollisionWithPlayer(object);
                case -1:
                    // Temporarily occupied tile (e.g., during a push)
                    if (object.type === 'object') return true; // Allow objects to pass through
                    
                default:
                    return false; // Unknown tile type
            }

        }
    }

    return true; // No collision
}

function handleInteractiveTile(gridX, gridY, layer) {
    const spriteX = Math.floor(gridX / 2); // Convert to 32x32 grid
    const spriteY = Math.floor(gridY / 2);
    const spriteKey = `${layer + 1},${spriteX},${spriteY}`;

    if (spriteKey in placedSprites) {
        const sprite = placedSprites[spriteKey];
        if (sprite.type === 'coin') {
            player.stats.coin += sprite.data.value;
            console.log(`Collected coin. Total coins: ${player.stats.coin}`);
        }
        if (sprite.type === 'ammo') {
            player.stats.ammo += sprite.data.value;
            console.log(`Collected ammo. Total ammo: ${player.stats.ammo}`);
        }
        if (sprite.type === 'key') {
            player.stats.keys += sprite.data.value;
            console.log(`Collected key. Total keys: ${player.stats.keys}`);
        }

        // Remove the sprite and update the grid
        delete placedSprites[spriteKey];
        updateGrid(currentCollisionGrid, layer, spriteX, spriteY, 0); // Set grid value to 0
        updateTile(layer + 1, spriteX, spriteY); // Update the tile visually
        renderLayersToMainCanvas(); // Redraw the canvas
    }
}

function handleSpecialTile(gridX, gridY, layer, object) {
    const spriteX = Math.floor(gridX / 2); // Convert to 32x32 grid
    const spriteY = Math.floor(gridY / 2);
    const spriteKey = `${layer + 1},${spriteX},${spriteY}`;

    if (spriteKey in placedSprites) {
        const sprite = placedSprites[spriteKey];
        if (sprite.type === 'sign' && object.type === 'player') {
            gamePaused = true; // Pause the game loop
            showDialog(sprite.data.script.replace(/(?:\r\n|\r|\n)/g, '<br>'));
        }
        if (sprite.type === 'object') {
            if (object.type === 'player') handleObjectInteraction(spriteKey, ':touch');
            if (object.type === 'bullet') handleObjectInteraction(spriteKey, ':shot');
        }
    }
}

function handleObjectCollisionWithPlayer(object) {
    if (object.type === 'enemy') {
        player.stats.health -= object.damage || 1;
        console.log(`Player hit by enemy! Health: ${player.stats.health}`);
        if (player.stats.health <= 0) {
            youDied();
        }
        return false; // Block movement
    }

    if (object.type === 'object') {
        console.log(object.type, 'collided with player!');
        return false; // Block movement
    }

    if (object.type === 'pushable') {
        console.log('Player pushed by object!');
        return tryPushPlayer(player.x, player.y, object.direction, player.layer);
    }

    return false; // Default: Block movement
}


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

function _drawBoard() {
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
                if (showPlayer && sprite.type === 'player') {
                    ctx.fillStyle = 'rgba(20, 0, 255, 0.5)'; // Semi-transparent red
                    ctx.fillRect(sprite.x * tileSizeX, sprite.y * tileSizeY, tileSizeX, tileSizeY); // Draw a rectangle around the player
                }
            });

        //console.log(`Layer ${layer} generated`);
    }
}

function drawBoard() {
    const sortedLayers = [1, 2, 3];

    for (const layer of sortedLayers) {
        const ctx = getLayerCanvas(layer);

        // CLEAR OFFSCREEN CANVAS BEFORE DRAWING
        ctx.clearRect(0, 0, layerCanvases[layer].width, layerCanvases[layer].height);

        // Draw all non-object sprites first
        Object.keys(placedSprites)
            .map(key => {
                const [l, x, y] = key.split(',').map(Number);
                return { l, x, y, ...placedSprites[key] };
            })
            .filter(sprite => sprite.l === layer && sprite.type !== 'object' && sprite.type !== 'passage' && sprite.type !== 'invisible' && sprite.type !== 'player') // Skip objects, passages, and invisible sprites
            .forEach(sprite => {
                drawSpriteToCanvas(ctx, sprite.x, sprite.y, tileSizeX, tileSizeY, sprite.sprite, sprite.color);
            });

        // Draw objects at the end
        Object.keys(placedSprites)
            .map(key => {
                const [l, x, y] = key.split(',').map(Number);
                return { l, x, y, ...placedSprites[key] };
            })
            .filter(sprite => sprite.l === layer && sprite.type === 'object') // Only objects
            .forEach(sprite => {
                drawSpriteToCanvas(ctx, sprite.x, sprite.y, tileSizeX, tileSizeY, sprite.sprite, sprite.color);
            });

        // Debugging: Log the layer rendering
        console.log(`Layer ${layer} rendered`);
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

            //ctx.save()
            //if (layer === 3) ctx.filter = 'opacity(0.8)';
            //if (layer === 2) ctx.filter = 'blur(1px)';
            //if (layer === 3) ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(layerCanvases[layer], 0, 0);
            //ctx.restore();

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
            let command = obj.script[obj.scriptIndex].split(' ');
            let action = command[0];
            let args = command.slice(1);

            executeObjectCommand(obj, action, args); // Start executing #commands

            // Move script index only if not waiting
            obj.scriptIndex++;

            if (command[0] === "#loop") {
                if (obj.labels[":loop"] !== undefined) {
                    obj.scriptIndex = obj.labels[":loop"]; // Jump to label position
                } else {
                    console.error("Error: Missing ':loop' label in script.");
                }
                continue;
            }

            // Auto-stop if script ends without `#end`
            if (obj.scriptIndex >= obj.script.length) {
                obj.resting = true;
            }

            obj.timeSinceLastMove = 0;
        }
    }
}

function executeObjectCommand(obj, action, args) {

    if (action.startsWith("@")) {
        // Set the object's name to everything after @
        obj.name = action.slice(1) + (args.length > 0 ? " " + args.join(" ") : "");
        return;
    }

    switch (action) {
        case '#end':
            obj.resting = true;
            break;
        case "#text":
            gamePaused = true; // Pause the game loop
            showDialog(args.join(" "), obj);
            break;
        case "#send":
            if (args.length === 1) {
                // Jump to a label within the same object
                const label = args[0];
                const index = resolveLabel(obj, label);
                if (index !== null) {
                    obj.scriptIndex = index; // Move the script execution to the label
                } else {
                    console.error(`Error: Label :${label} not found in script.`);
                }
            } else if (args.length === 2 && args[0].startsWith("@")) {
                // Call another object's script at a specific label
                const targetName = args[0].slice(1); // Remove '@' to get the object name
                const label = args[1];

                // Find the target object by name
                const targetObject = Object.values(placedObjects).find(o => o.name === targetName);
                if (!targetObject) {
                    console.error(`Error: Object with name "${targetName}" not found.`);
                    break;
                }

                // Resolve the label in the target object's script
                const index = resolveLabel(targetObject, label);
                if (index !== null) {
                    targetObject.scriptIndex = index; // Start execution at the label
                    targetObject.resting = false; // Wake up the target object
                } else {
                    console.error(`Error: Label :${label} not found in object "${targetName}".`);
                }
            } else {
                console.error(`Error: Invalid #send command arguments: ${args.join(" ")}`);
            }
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
        case '#color':
        case '#changecolor':
            if (args[0] === "undefined") { console.warn("No color provided"); return; }
            let color = extractRGB(args[0]); // Extract RGB values
            let spriteKey = `${obj.layer},${obj.x},${obj.y}`;
            placedSprites[spriteKey].color = color; // Update color
            placedObjects[spriteKey].color = color; // Update object color
            updateTile(obj.layer, obj.x, obj.y); // Update tile with new color
            renderLayersToMainCanvas(); // Ensure visual update
            break;
        case '#sprite':
        case '#changesprite':
            if (args[0] === "undefined" || isNaN(args[0])) { console.warn("No sprite provided or NaN"); return; }
            let spriteKeyChange = `${obj.layer},${obj.x},${obj.y}`;
            placedSprites[spriteKeyChange].sprite = parseInt(args[0], 10); // Update sprite
            placedObjects[spriteKeyChange].sprite = parseInt(args[0], 10); // Update object sprite
            updateTile(obj.layer, obj.x, obj.y); // Update tile with new sprite
            renderLayersToMainCanvas(); // Ensure visual update
            break;
        case "#timer":
            obj.timer = parseInt(args[0], 10); // Set timer
            break;
        case '#move':
            let direction = args[0];

            if (direction === 'seek') {
                direction = calculateSeekDirection(obj, player); // Calculate the direction to the player
            } else {
                direction = convertDirections(args[0]);
            }
            if (direction === -1) {
                console.warn(`Invalid direction "${args[0]}" provided for #move`);
                return;
            }

            moveObject(obj, direction, obj.layer);
            break;
        case '#shoot':
            if (args[0] === 'undefined') { console.warn('No direction provided'); return; }
            if (args[0] === 'seek') {
                // Implement seeking logic here
                console.warn('Seeking bullets not implemented yet');
                return;
            }
            let bulletDirection = convertDirections(args[0]);
            if (bulletDirection === -1) {
                console.warn(`Invalid direction "${args[0]}" provided for bullet`);
                return;
            }

            let { x, y } = calculateBulletPosition(obj.x, obj.y, bulletDirection);
            let bullet = createBullet(canvas, x, y, bulletDirection, 16, 'white', obj.name);
            //bullet.origin = obj; // Track the object that fired the bullet
            bullet.origin = `${obj.layer},${obj.x},${obj.y}`; // Track the object that fired the bullet
            bulletArray.push(bullet);
            console.log(`Creating bullet at (${x}, ${y}) with direction ${bulletDirection}`);
            break;
        case '#wait':
            obj.waiting = true; // Set waiting state
            //obj.waitTime = parseInt(args[0], 10) * 10; // Store remaining time in milliseconds
            obj.waitTime = (parseInt(args[0], 10) || 1) * 50; // Default to 50ms if no valid argument is provided
            break;
        case '#loop':
            obj.scriptIndex = obj.labels[':loop'] || 0;
            break;
        case '#zap':
            const zapLabel = `:${args[0]}`;
            if (!obj.zappedLabels[zapLabel]) {
                obj.zappedLabels[zapLabel] = 1;
            } else {
                obj.zappedLabels[zapLabel]++;
            }
            break;
        case '#restore':
            const restoreLabel = `:${args[0]}`;
            delete obj.zappedLabels[restoreLabel];
            break;
        case "#trigger":
            let triggerLabel = args[0];
            let index = resolveLabel(obj, triggerLabel);
            if (index !== null) {
                obj.scriptIndex = index;
            } else {
                console.warn(`No active labels found for :${triggerLabel}`);
            }
            break;
        case '#take':
            let item = args[0];
            let amount = parseInt(args[1], 10);
            if (isNaN(amount)) amount = 1; // Default to 1 if not specified
            takeStat(player, item, amount);
            console.log(`Took ${amount} ${item}(s)`);
            break;
        case '#give':
            let itemGive = args[0];
            let amountGive = parseInt(args[1], 10);
            if (isNaN(amountGive)) amountGive = 1; // Default to 1 if not specified
            giveStat(player, itemGive, amountGive);
            console.log(`Gave ${amountGive} ${itemGive}(s)`);
            break;
        case '#nightmode':
            nightMode = !nightMode;
            break;
        case '#die':
            delete placedObjects[`${obj.layer},${obj.x},${obj.y}`];
            delete placedSprites[`${obj.layer},${obj.x},${obj.y}`];
            updateTile(obj.layer, obj.x, obj.y);
            break;
        default:
            console.warn(`Unknown command: ${action}`);
    }
}

function _moveObject(obj, direction, layer) {
    const offsets = { up: [0, -0.5], down: [0, 0.5], left: [-0.5, 0], right: [0.5, 0] };
    const dir = convertDirections(direction);

    if (!offsets[dir]) {
        console.warn(`Invalid direction: ${direction} for #move`);
        return; // Invalid direction guard
    }

    const [dx, dy] = offsets[dir];
    const [newX, newY] = [obj.x + dx, obj.y + dy];

    obj.direction = dir; // Update the object's direction

    // Remove the object from the collision grid at the old position
    updateGrid(currentCollisionGrid, layer - 1, obj.x, obj.y, 0);

    // Check if the object can move to the new position
    if (canMoveTo(newX, newY, obj)) {


        // Update the object's position
        obj.x = newX;
        obj.y = newY;

        // Add the object to the collision grid at the new position
        updateGrid(currentCollisionGrid, layer - 1, obj.x, obj.y, 5); // Use `5` for objects

        // Update `placedObjects` and `placedSprites` keys
        const oldKey = `${layer},${Math.floor(obj.x - dx)},${Math.floor(obj.y - dy)}`;
        const newKey = `${layer},${Math.floor(obj.x)},${Math.floor(obj.y)}`;

        placedObjects[newKey] = placedObjects[oldKey];
        delete placedObjects[oldKey];

        placedSprites[newKey] = placedSprites[oldKey];
        delete placedSprites[oldKey];

        // Update the visual representation of the object
        updateTile(layer, Math.floor(obj.x), Math.floor(obj.y));
    } else {
        //console.log(`Object at (${obj.x}, ${obj.y}) cannot move to (${newX}, ${newY})`);
    }
}

function moveObject(obj, direction, layer) {
    //const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const offsets = { up: [0, -0.5], down: [0, 0.5], left: [-0.5, 0], right: [0.5, 0] };
    const dir = convertDirections(direction);

    if (!offsets[dir]) {
        console.warn(`Invalid direction: ${direction} for #move`);
        return; // Invalid direction guard
    }

    const [dx, dy] = offsets[dir];
    const [newX, newY] = [obj.x + dx, obj.y + dy];
    //const [oldX, oldY] = [obj.x, obj.y];

    const oldKey = `${layer},${obj.x},${obj.y}`;
    const newKey = `${layer},${newX},${newY}`;
    //const oldKey = `${layer},${Math.floor(obj.x)},${Math.floor(obj.y)}`;
    //const newKey = `${layer},${Math.floor(newX)},${Math.floor(newY)}`;

    obj.direction = dir; // change the object's direction

    //if (placedObjects[newKey]) return; // Prevent movement if occupied by another object
    // Remove the object from the collision grid at the old position
    updateGrid(currentCollisionGrid, layer - 1, obj.x, obj.y, 0); // Use -1 for temporary moving state

    if (canMoveTo(newX, newY, obj)) { // can the object move?

        placedSprites[newKey] = placedSprites[oldKey]; // Move sprite
        placedObjects[newKey] = obj;

        delete placedObjects[oldKey];
        delete placedSprites[oldKey];

        updateTile(layer, obj.x, obj.y); // Clear old tile

        obj.x = newX;
        obj.y = newY;

        // Add the object to the collision grid at the new position
        //updateGrid(currentCollisionGrid, layer - 1, oldX, oldY, 0); // Use `5` for objects
        updateGrid(currentCollisionGrid, layer - 1, obj.x, obj.y, 5); // Use `5` for objects

        // Update the visual representation of the object
        //updateTile(layer, obj.x, obj.y); // Update new tile
        //updateTile(layer, Math.floor(obj.x), Math.floor(obj.y));
        updateTile(layer, obj.x, obj.y);
    }
    else {
        //console.warn(`Object ${obj.name || 'unknown'} cannot move to (${newX}, ${newY})`);
        updateGrid(currentCollisionGrid, layer - 1, obj.x, obj.y, 5);
        console.log(`Object at (${obj.x}, ${obj.y}) cannot move to (${newX}, ${newY})`);
        return; // no can move
    }
}

function handleObjectInteraction(tileKey, labelType) {
    let obj = placedObjects[tileKey];
    if (obj && obj.labels[labelType]) {
        let index = resolveLabel(obj, labelType);
        if (index !== null) {
            obj.scriptIndex = index; // Set the script index to the label
            obj.waitTime = 0; // Reset wait time
            obj.waiting = false; // Reset waiting state
        } else {
            console.warn(`No active ${labelType} labels found.`);
        }
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

function findClosestObject(x, y) {
    let closestObject = null;
    let closestDistance = Infinity;

    for (const key in placedObjects) {
        const obj = placedObjects[key];

        const objCenterX = obj.x + obj.width / tileSizeX / 2;
        const objCenterY = obj.y + obj.height / tileSizeY / 2;

        const dx = objCenterX - x;
        const dy = objCenterY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestObject = obj;
        }
    }

    return closestObject;
}

function isAlignedWithTile(object) {
    const epsilon = 0.01; // Small tolerance for floating-point precision
    const isAlignedX = Math.abs(object.x - Math.round(object.x)) < epsilon;
    const isAlignedY = Math.abs(object.y - Math.round(object.y)) < epsilon;
    return isAlignedX && isAlignedY;
}

function _checkBulletTiles(x, y) {
    const bulletSize = 8; // Bullet collision area (8x8)

    let leftTile = Math.floor((x - bulletSize) / tileSizeX);
    let topTile = Math.floor((y - bulletSize) / tileSizeY);
    let rightTile = Math.floor((x + bulletSize) / tileSizeX);
    let bottomTile = Math.floor((y + bulletSize) / tileSizeY);

    const tileSet = new Set();

    for (let tx = leftTile; tx <= rightTile; tx++) {
        for (let ty = topTile; ty <= bottomTile; ty++) {
            const offsets = [
                [0, 0],
                [-0.5, 0],
                [0.5, 0],
                [0, -0.5],
                [0, 0.5]
            ];

            for (const [dx, dy] of offsets) {
                const fx = tx + dx;
                const fy = ty + dy;

                if (fx >= 0 && fy >= 0) {
                    tileSet.add(`${fx},${fy}`);
                }
            }
        }
    }

    // Convert back into array of tile objects
    const tiles = Array.from(tileSet).map(key => {
        const [xStr, yStr] = key.split(',');
        return { x: parseFloat(xStr), y: parseFloat(yStr) };
    });

    return tiles;
}

function checkBulletTiles(bulletX, bulletY, bulletWidth = 8, bulletHeight = 8) {
    const bulletLeft = bulletX - bulletWidth / 2;
    const bulletTop = bulletY - bulletHeight / 2;
    const bulletRight = bulletX + bulletWidth / 2;
    const bulletBottom = bulletY + bulletHeight / 2;

    const tiles = [];

    // Check all tiles the bullet overlaps
    const leftTile = Math.floor(bulletLeft / tileSizeX);
    const topTile = Math.floor(bulletTop / tileSizeY);
    const rightTile = Math.floor(bulletRight / tileSizeX);
    const bottomTile = Math.floor(bulletBottom / tileSizeY);

    for (let tx = leftTile; tx <= rightTile; tx++) {
        for (let ty = topTile; ty <= bottomTile; ty++) {
            tiles.push({ x: tx, y: ty });
        }
    }

    // Check if the bullet overlaps with the player
    if (isOverlappingTile(player, bulletX / tileSizeX, bulletY / tileSizeY)) {
        console.log('Bullet overlaps with player!');
        tiles.push({ x: player.x, y: player.y });
    }

    return tiles;
}

function isOverlappingAnyObject(bulletX, bulletY, bulletWidth = 8, bulletHeight = 8) {
    const bulletLeft = bulletX - bulletWidth / 2;
    const bulletTop = bulletY - bulletHeight / 2;
    const bulletRight = bulletX + bulletWidth / 2;
    const bulletBottom = bulletY + bulletHeight / 2;

    for (const key in placedObjects) {
        const obj = placedObjects[key];

        const objLeft = obj.x * tileSizeX;
        const objTop = obj.y * tileSizeY;
        const objRight = objLeft + obj.width;
        const objBottom = objTop + obj.height;

        // Check if the bullet overlaps the object
        if (!(bulletRight <= objLeft ||
            bulletLeft >= objRight ||
            bulletBottom <= objTop ||
            bulletTop >= objBottom)) {
            return obj; // Return the overlapping object
        }
    }

    return null; // No overlapping object found
}

function _canMoveTo(x, y, object = player) {

    //console.log('Checking collision for:', object.name, object.direction, 'at', x, y);
    //console.log('tiles:', checkTiles(x * tileSizeX, y * tileSizeY, object.direction));

    let tiles = [];
    //if (object.type === 'bullet') tiles = checkBulletTiles(x * tileSizeX, y * tileSizeY, object.oldX, object.oldY);
    if (object.type === 'bullet') {
        tiles = checkBulletTiles(x * tileSizeX, y * tileSizeY, object.width || 8, object.height || 8);
    } else {
        tiles = checkTiles(x * tileSizeX, y * tileSizeY, object.direction);
    }

    for (let tile of tiles) {

        let tileKey = `${object.layer},${tile.x},${tile.y}`;

        if (tile.x < 0 || tile.y < 0 || tile.y >= tilesY || tile.x >= tilesX) {
            return false; // Out of bounds = collision
        }

        if (isOverlappingTile(player, tile.x, tile.y) && object.type === 'object') { // Check if the player is overlapping with the object using a drop-in bounding box
            console.log('player detected!');
            return tryPushPlayer(player.x, player.y, object.direction, object.layer);
        }

        if (placedSprites[tileKey]) {
            let tileType = placedSprites[tileKey].type;

            // Collision with walls or breakable objects
            if (tileType === 'wall' || tileType === 'break' || tileType === 'sign' || tileType === 'object' || tileType === 'invisible') {
                // If it's a bullet hitting a breakable tile
                if (object.type === 'bullet' && tileType === 'break') {
                    delete placedSprites[tileKey];
                    updateTile(object.layer, tile.x, tile.y);
                }
                // if it's a sign, show script
                if (tileType === 'sign' && object.type === 'player') {
                    gamePaused = true; // Pause the game loop
                    showDialog(placedSprites[tileKey].data.script
                        .replace(/(?:\r\n|\r|\n)/g, '<br>'));
                }

                if (object.type === 'bullet' && tileType === 'invisible') {
                    return true;
                }

                if (tileType === 'object' && object.type === 'player') {
                    handleObjectInteraction(tileKey, ":touch");
                }

                if (tileType === 'object' && object.type === 'bullet') {
                    handleObjectInteraction(tileKey, ":shot");
                }

                return false;
            }

            // Ignore collisions with the bullet's origin
            //if (object.type === 'bullet' && object.origin === placedSprites[tileKey]) {
            if (object.type === 'bullet' && object.origin === tileKey) {
                console.log('Ignoring collision with origin:', tileKey);
                continue; // Skip collision with the origin
            }

            if (object.type === 'bullet' && object.origin === 'player' && tileType === 'player') {
                return true;    // Bullet hit something (not itself or its owner)
            }

            //if (object === 'bullet' && tileType === 'object' && object.origin === 'object') return true; 
            if (tileType === 'player' && object.type === 'object') {
                console.log('object push. player: ', x, y);
                return tryPushTiles(player.x, player.y, object.direction, object.layer);
            }

            // Picking up an item or destroying tile
            if (tileType === 'item' && object.type === 'player' || tileType === 'step' && object.type === 'player') {
                delete placedSprites[tileKey];
                updateTile(player.layer, tile.x, tile.y);
                return true;
            }

            if (tileType === 'coin' && object.type === 'player' || tileType === 'ammo' && object.type === 'player') {
                if (tileType === 'coin') player.stats.coin += placedSprites[tileKey].data.value;
                if (tileType === 'ammo') player.stats.ammo += placedSprites[tileKey].data.value;
                console.log('Player stats:', player.stats);
                delete placedSprites[tileKey];
                updateTile(player.layer, tile.x, tile.y);
                return true;
            }

            if (object.type === 'bullet' && tileType === 'player') {
                // Handle bullet hitting player
                console.log('Hit player!');
                return false; // Prevent movement
            }

            // If it's a pushable block
            if (tileType === 'push') {
                return tryPushTiles(tile.x, tile.y, object.direction, object.layer);
            }
        }

        if (placedPassages[tileKey]) {
            let tileType = placedPassages[tileKey].type;

            if (tileType === 'passage' && object.type === 'player') {
                // Ensure the player is perfectly aligned with the tile
                if (!isAlignedWithTile(player)) {
                    return false; // Prevent activation if not aligned
                }

                // Check to see if the player is fully on the tile before moving
                if (!isOverlappingTile(player, tile.x, tile.y)) {
                    // Handle passage logic here
                    player.locked = true; // Lock player movement
                    let targetBoard = placedPassages[tileKey].data.board;
                    let passageColor = placedPassages[tileKey].color;
                    let colorKey = passageColor.join(','); // Create a unique key for the color
                    console.log('Switching to board:', targetBoard, 'with colorKey:', colorKey); // Debug log
                    switchBoard(targetBoard, colorKey); // Pass the color key to switchBoard
                    return true; // Prevent movement
                }
                return false; // Prevent movement if not fully on the tile
            }
        }
    }

    return true;
}

function tryPushTiles(startX, startY, direction, layer) {
    const pushTiles = [];
    let x = Math.floor(startX); // Align to grid
    let y = Math.floor(startY);

    // Determine the direction offsets
    let dx = 0, dy = 0;
    switch (direction) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
        default:
            console.warn(`Invalid direction: ${direction}`);
            return false;
    }

    console.log(`Direction: ${direction}, dx: ${dx}, dy: ${dy}`);
    console.log(`Starting tile at (${x}, ${y})`);

    // Collect all pushable tiles in the direction
    while (true) {
        const spriteX = Math.floor(x); // Convert to 32x32 grid
        const spriteY = Math.floor(y);
        const key = `${layer},${spriteX},${spriteY}`;
        console.log(`Checking tile at (${x}, ${y}), key: ${key}`);

        if (!placedSprites[key]) {
            console.warn(`No sprite found at key: ${key}`);
            break;
        }
        if (placedSprites[key].type !== 'push') {
            console.warn(`Sprite at key ${key} is not pushable:`, placedSprites[key]);
            break;
        }

        pushTiles.push({ x: spriteX, y: spriteY }); // Add the current tile to the list
        x += dx; // Move to the next tile in the direction
        y += dy;
    }

    if (pushTiles.length === 0) {
        console.warn('No pushable tiles found');
        return false;
    }

    // Determine the new position for the last tile
    const lastTile = pushTiles[pushTiles.length - 1];
    const newX = lastTile.x + dx;
    const newY = lastTile.y + dy;

    // Check if the new position is valid
    const newKey = `${layer},${newX},${newY}`;
    const newKey2 = `${layer},${Math.floor(newX)},${Math.floor(newY)}`;
    if (newX < 0 || newY < 0 || newX >= tilesX || newY >= tilesY || placedSprites[newKey] || placedSprites[newKey2]) {
        console.warn(`Cannot push tiles to (${newX}, ${newY}), key: ${newKey}`);
        return false;
    }

    // Move all pushable tiles to their new positions
    for (let i = pushTiles.length - 1; i >= 0; i--) {
        const oldX = pushTiles[i].x;
        const oldY = pushTiles[i].y;
        const newX = oldX + dx;
        const newY = oldY + dy;

        const oldKey = `${layer},${oldX},${oldY}`;
        const newKey = `${layer},${newX},${newY}`;

        // Update placedSprites
        placedSprites[newKey] = placedSprites[oldKey]; // Move the sprite
        delete placedSprites[oldKey]; // Remove the old position

        // Update the collision grid
        updateGrid(currentCollisionGrid, layer - 1, oldX, oldY, 0); // Clear the old position
        updateGrid(currentCollisionGrid, layer - 1, newX, newY, 2); // Mark the new position

        // Update the visual representation of the tiles
        updateTile(layer, oldX, oldY); // Clear the old tile visually
        updateTile(layer, newX, newY); // Draw the new tile visually
    }

    return true; // Successfully pushed the tiles
}

function __tryPushTiles(startX, startY, direction, layer) {
    const pushTiles = [];

    let x = startX;
    let y = startY;

    // Determine the direction offsets
    let dx = 0, dy = 0;
    switch (direction) {
        case 'up': dy = -0.5; break;
        case 'down': dy = 0.5; break;
        case 'left': dx = -0.5; break;
        case 'right': dx = 0.5; break;
        default:
            console.warn(`Invalid direction: ${direction}`);
            return false;
    }

    console.log(`Direction: ${direction}, dx: ${dx}, dy: ${dy}`);
    console.log(`Checking tile at (${x}, ${y})`);

    // Collect all pushable tiles in the direction
    while (true) {
        //const key = `${layer},${x},${y}`;
        const spriteX = Math.floor(x); // Convert to 32x32 grid
        const spriteY = Math.floor(y);
        const key = `${layer},${spriteX},${spriteY}`;
        console.log('Checking tile:', key);
        //if (!placedSprites[key] || placedSprites[key].type !== 'push') break;

        if (!placedSprites[key]) {
            console.log(`No sprite found at key: ${key}`);
            break;
        }

        if (placedSprites[key].type !== 'push') {
            console.log(`Sprite at key ${key} is not pushable:`, placedSprites[key]);
            break;
        }

        pushTiles.push({ x, y }); // Add the current tile to the list
        x += dx; // Move to the next tile in the direction
        y += dy;
    }

    if (pushTiles.length === 0) {
        console.warn('No pushable tiles found');
        return false;
    }

    // Determine the new position for the last tile
    const lastTile = pushTiles[pushTiles.length - 1];
    const newX = lastTile.x + dx;
    const newY = lastTile.y + dy;

    // Check if the new position is valid
    const newKey = `${layer},${newX},${newY}`;
    if (newX < 0 || newY < 0 || newX >= tilesX || newY >= tilesY || placedSprites[newKey]) {
        return false; // Cannot push if out of bounds or blocked
    }

    // Move all pushable tiles to their new positions
    for (let i = pushTiles.length - 1; i >= 0; i--) {
        const oldX = pushTiles[i].x;
        const oldY = pushTiles[i].y;
        const newX = oldX + dx;
        const newY = oldY + dy;

        const oldKey = `${layer},${oldX},${oldY}`;
        const newKey = `${layer},${newX},${newY}`;

        // Update placedSprites
        placedSprites[newKey] = placedSprites[oldKey]; // Move the sprite
        delete placedSprites[oldKey]; // Remove the old position

        // Update the collision grid
        updateGrid(currentCollisionGrid, layer - 1, oldX, oldY, 0); // Clear the old position
        updateGrid(currentCollisionGrid, layer - 1, newX, newY, 2); // Mark the new position

        // Update the visual representation of the tiles
        updateTile(layer, oldX, oldY); // Clear the old tile visually
        updateTile(layer, newX, newY); // Draw the new tile visually
    }

    return true; // Successfully pushed the tiles
}

function _tryPushTiles(startX, startY, direction, layer) {
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

    if (isOverlappingTile(player, newX, newY)) return false;

    // Prevent pushing off the board
    if (newX < 0 || newY < 0 || newX >= tilesX || newY >= tilesY) {
        return false;
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

    return true;
}

// #########################################
// ############ Player movement ############
// #########################################

function updatePlayer(deltaTime) {
    accumulatedTime += deltaTime;
    if (accumulatedTime < moveSpeed) return; // Wait for the next frame
    accumulatedTime = 0;

    if (loaded === false) return; // Don't move if not loaded

    //let oldTiles = getOverlappingTiles(player.x * 32, player.y * 32);
    let newX = player.x;
    let newY = player.y;
    // old x and y?

    if (player.stats.health === 0) youDied();

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
        // Remove the player from the grid at the current position
        updatePlayerInGrid(currentCollisionGrid, player.layer - 1, player.x, player.y, 0);

        if (!player.transported) {
            const oldKey = `${player.layer},${player.x},${player.y}`;
            const newKey = `${player.layer},${newX},${newY}`;

            player.x = newX;
            player.y = newY;

            placedSprites[newKey] = placedSprites[oldKey];
            delete placedSprites[oldKey];
        }
        player.transported = false;

        // Add the player to the grid at the new position
        updatePlayerInGrid(currentCollisionGrid, player.layer - 1, player.x, player.y, 9); // Use `9` for player
        renderLayersToMainCanvas();
    }
}

function movePlayer(newLayer, newX, newY) {

    const oldKey = `${player.layer},${player.x},${player.y}`;
    const newKey = `${newLayer},${newX},${newY}`;

    //console.log('Moving player:', { oldKey, newKey });

    // Update the global player object
    player.layer = newLayer;
    player.x = newX;
    player.y = newY;
    player.transported = true; // Mark player as moved

    // Update placedSprites
    if (placedSprites[oldKey]) {
        placedSprites[newKey] = placedSprites[oldKey]; // Move player sprite to the new key
        delete placedSprites[oldKey]; // Remove player sprite from the old key
    } else {
        console.warn(`Old key ${oldKey} not found in placedSprites.`);
    }

    //console.log('Player moved to:', { layer: newLayer, x: newX, y: newY });

    // Redraw the board
    //renderLayersToMainCanvas();
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

    // Reset passages
    worldPassages = {};

    // Initialize collision grids for all boards
    collisionGrids = initializeBoardCollisionGrids(world, canvas.width, canvas.height, 3);

    // Extract passages, objects, and populate collision grids for all boards
    for (const board in world) {
        const boardData = world[board];

        // Load passages
        loadPassagesFromGameData(boardData, board);

        // Load objects
        worldObjects[board] = loadObjectsFromGameData(boardData);

        // Populate the collision grid for this board
        populateCollisionGrid(collisionGrids[board], boardData);
    }

    console.log('Loaded world data:', worldData);
    console.log('Loaded world objects:', worldObjects);
    console.log('Collision grids:', collisionGrids);

    // Set the current board
    currentBoard = 2;
    placedSprites = world[currentBoard]; // Get the current board from the world object
    placedObjects = worldObjects[currentBoard]; // Get objects for the current board
    placedPassages = worldPassages[currentBoard] || {}; // Load passages for the current board

    // Populate the collision grid for the current board
    currentCollisionGrid = collisionGrids[currentBoard];
    populateCollisionGrid(currentCollisionGrid, placedSprites);

    loaded = true;
    player = findPlayerSprite();
    playerStats = structuredClone(defaultPlayerStats); // Reset player stats
    player = { ...playerStats, ...player };

    nightMode = false;

    console.log('Loaded World');
    drawBoard();
    renderLayersToMainCanvas(); // Draw them onto the main canvas
}

function _handleLoadedGame(spriteSheetData, boardList, worldData) {
    deactivateAllBullets(bulletArray); // Deactivate all bullets
    boards = boardList; // Load the board list
    world = worldData; // Load the world data
    replaceSpriteSheet(spriteSheetData); // Load the sprite sheet data

    // Reset passages
    worldPassages = {};

    // Extract passages and objects for all boards
    for (const board in world) {
        loadPassagesFromGameData(world[board], board); // Load passages
        worldObjects[board] = loadObjectsFromGameData(world[board]); // Load objects
    }

    console.log('Loaded world data:', worldData);
    console.log('Loaded world objects:', worldObjects);

    currentBoard = 2;
    placedSprites = world[currentBoard]; // Get the current board from the world object
    placedObjects = worldObjects[currentBoard]; // Get objects for the current board
    placedPassages = worldPassages[currentBoard] || {}; // Load passages for the current board

    loaded = true;
    player = findPlayerSprite();
    playerStats = structuredClone(defaultPlayerStats); // Reset player stats
    player = { ...playerStats, ...player };

    nightMode = false;

    console.log('Loaded World');
    drawBoard();
    renderLayersToMainCanvas(); // Draw them onto the main canvas
}

function loadPassagesFromGameData(gameData, board) {
    if (!worldPassages[board]) {
        worldPassages[board] = {}; // Initialize storage for the board if it doesn't exist
    }

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

    placedSprites = {};
    placedSprites = world[board]; // Get the current board from the world object
    placedObjects = worldObjects[board]; // Use preloaded objects

    // Clear and reload passages
    placedPassages = {};
    placedPassages = worldPassages[board] || {}; // Load passages for the current board


    let playerSprite = findPlayerSprite();
    if (!playerSprite) {
        console.error('No player sprite found on the new board.');
        return; // Exit if no player sprite is found
    }

    player = { ...player, ...playerSprite };
    console.log('Player:', player.direction);

    console.log(`Switching to board ${board}`);

    // Lookup passage color in placedPassages for a match
    for (const key in placedPassages) {
        const passage = placedPassages[key];
        const passageColorKey = passage.color.join(','); // Create a unique key for the passage color

        if (passageColorKey === colorKey) { // Compare the color keys
            const [layer, x, y] = key.split(',').map(Number); // Extract layer, x, y from the key
            movePlayer(layer, x, y); // Use movePlayer to update the player's position
            break; // Exit loop after finding the first match
        }
    }
    player.locked = false; // Unlock player movement

    currentBoard = board;
    removeUndefinedSprites(); // Remove undefined sprites from the current board
    drawBoard();
    renderLayersToMainCanvas(); // Draw them onto the main canvas
}

function _switchBoard(board, colorKey) {
    currentBoard = board;

    placedSprites = world[currentBoard]; // Get the current board from the world object
    placedObjects = loadObjectsFromGameData(placedSprites);
    placedPassages = worldPassages[board] || {}; // Load passages for the current board

    //console.log('Switching to board:', board, 'with colorKey:', colorKey);
    console.log('finding:', findPlayerSprite());

    let foundPassage = false;

    for (const key in placedPassages) {
        const passage = placedPassages[key];
        const passageColorKey = passage.color.join(','); // Create a unique key for the passage color

        console.log('Player position before:', player.layer, player.x, player.y); // Debug log
        console.log('Checking passage:', key, 'with colorKey:', passageColorKey);

        if (passageColorKey === colorKey) { // Compare the color keys
            const [layer, x, y] = key.split(',').map(Number); // Extract layer, x, y from the key

            // Update player's position
            player.layer = layer;
            player.x = x;
            player.y = y;

            // Update placedSprites
            placedSprites[findPlayerSprite()] = placedSprites[`${layer},${x},${y}`]; // Move player to the new key

            foundPassage = true;
            console.log('Found matching passage at:', { layer, x, y });
            break; // Exit loop after finding the first match
        }
    }

    if (!foundPassage) {
        console.warn('No matching passage found for colorKey:', colorKey);
        player = findPlayerSprite(); // Fallback to find player sprite
    } else {
        console.log('Rendering player at new position:', { layer: player.layer, x: player.x, y: player.y });
        //placedSprites[newKey] = placedSprites[oldKey]; // Move player to the new key
    }

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
    console.warn('No player sprite found on the current board.');
    return null; // Return null if no player is found
}

function removeUndefinedSprites() {
    for (const key in placedSprites) {
        if (placedSprites[key] === undefined) {
            delete placedSprites[key];
            console.log('Removed undefined sprite at key:', key);
        }
    }
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

    if (!player.locked) { // Prevent input if player is locked

        if (event.key === 'l' && !gamePaused) { // load game
            loadCombinedData(handleLoadedBoard);
        }

        if (event.key === 'r') {
            drawBoard(); // Generate all layers
            renderLayersToMainCanvas(); // Draw them onto the main canvas
        }

        if (event.key === 'p') {
            gamePaused = !gamePaused;
            if (!gamePaused) requestAnimationFrame(animateGame);
        }

        if (event.key === ' ' && !gamePaused) { // Space bar to shoot
            bulletArray.push(createBullet(canvas, player.x + 0.5, player.y + 0.5, player.direction));
        }

        if (event.key === 'n') { // M to toggle night mode (TEMPORARY)
            nightMode = !nightMode;
            renderLayersToMainCanvas(); // Redraw layers to apply night mode
        }

        if (event.key === 'f') { // show player location
            console.log('Placed sprites:', placedSprites);
            console.log('Player location:', player.layer, player.x, player.y);
            console.log('Health:', player.stats.health);
            console.log('Player stats:', player.stats);
            console.log('Grid:', currentCollisionGrid);
            showPlayer = true;
        }
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