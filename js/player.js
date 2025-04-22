import { loadCombinedData, loadWorld } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, drawPlayerSprite, drawSpriteImage, getSprite } from './sprite.js';
import { createBullet } from './weapons.js';
import { defaultPlayerStats } from './player-stats.js';
import { extractRGB, namedColors, loadObjectsFromGameData, resolveLabel, convertDirections, takeStat } from './object-functions.js';
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

// World variables
let world = {}; // World object
let worldPassages = {}; // Stores passages for all boards

// Player
let player = defaultPlayerStats; // Player object
let playerStats = defaultPlayerStats;
//let stats = playerStats;
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
            .filter(sprite => sprite.l === layer && sprite.type !== 'passage') // Skip rendering passages
            .forEach(sprite => {
                if (sprite.type !== 'player') {
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
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the main canvas
    const sortedLayers = [1, 2, 3];

    for (const layer of sortedLayers) {
        if (layerCanvases[layer]) {

            //ctx.save()
            //if (layer === 3) ctx.filter = 'opacity(0.8)';
            //if (layer === 2) ctx.filter = 'blur(1px)';
            //if (layer === 3) ctx.globalCompositeOperation = "destination-over";
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

            executeObjectCommand(obj, action, args); // Start executing #commands

            // Move script index only if not waiting
            obj.scriptIndex++;

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
            placedSprites[spriteKey].color = color; // Update color
            placedObjects[spriteKey].color = color; // Update object color
            updateTile(obj.layer, obj.x, obj.y); // Update tile with new color
            renderLayersToMainCanvas(); // Ensure visual update
            break;
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
            switch (args[0]) {
                case 'north': direction = 'up'; break;
                case 'south': direction = 'down'; break;
                case 'east': direction = 'right'; break;
                case 'west': direction = 'left'; break;
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
            let x = obj.x;
            let y = obj.y;

            if (bulletDirection === -1) console.warn(`Invalid direction "${args[0]}" provided for bullet`);

            switch (bulletDirection) {
                case 'up':
                    bulletDirection = 'up';
                    y -= 0.5;
                    x += 0.5;
                    break;
                case 'down':
                    bulletDirection = 'down';
                    y += 1;
                    x += 0.5;
                    break;
                case 'right':
                    bulletDirection = 'right';
                    x += 1;
                    y += 0.5;
                    break;
                case 'left':
                    bulletDirection = 'left';
                    x -= 0.5;
                    y += 0.5;
                    break;
            }
            let bullet = createBullet(canvas, x, y, bulletDirection, 16, 'white', obj.name);
            bulletArray.push(bullet);
            break;
        case '#wait':
            obj.waiting = true; // Set waiting state
            obj.waitTime = parseInt(args[0], 10); // Store remaining cycles
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
            console.log(player.health);
            break;
        case '#nightmode':
            nightMode = !nightMode;
            break;
        case '#die':
            placedObjects[`${obj.layer},${obj.x},${obj.y}`];
            placedSprites[`${obj.layer},${obj.x},${obj.y}`];
            updateTile(obj.layer, obj.x, obj.y);
            break;
        default:
            console.warn(`Unknown command: ${action}`);
    }
}

function moveObject(obj, direction, layer) {
    const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const dir = convertDirections(direction);

    if (!offsets[dir]) {
        console.warn(`Invalid direction: ${direction} for #move`);
        return; // Invalid direction guard
    }

    const [dx, dy] = offsets[dir];
    const [newX, newY] = [obj.x + dx, obj.y + dy];

    const oldKey = `${layer},${obj.x},${obj.y}`;
    const newKey = `${layer},${newX},${newY}`;

    if (placedObjects[newKey]) return; // Prevent movement if occupied by another object
    //if (placedSprites[newKey]) {
    if (canMoveTo(newX, newY, obj)) { // can the object move?


        placedSprites[newKey] = placedSprites[oldKey]; // Move sprite
        placedObjects[newKey] = obj;

        delete placedObjects[oldKey];
        delete placedSprites[oldKey];

        updateTile(layer, obj.x, obj.y); // Clear old tile

        obj.x = newX;
        obj.y = newY;
        obj.direction = dir; // change the object's direction

        updateTile(layer, obj.x, obj.y); // Update new tile
    }
    else {
        return; // no
    }
    //}
}

function handleObjectTouch(tileKey) {
    let obj = placedObjects[tileKey];
    if (obj && obj.labels[":touch"]) {
        //obj.scriptIndex = obj.labels[":touch"];
        let index = resolveLabel(obj, ":touch");
        if (index !== null) {
            obj.scriptIndex = index;
        } else {
            // Optionally skip or log that all labels were zapped
            console.warn("No active :touch labels found.");
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

function checkTiles(x, y, direction) {
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

function _isOverlappingTile(object, tileX, tileY) {
    const buffer = 0.01; // Small value to prevent edge-only contact

    const tileLeft = tileX * tileSizeX + buffer;
    const tileTop = tileY * tileSizeY + buffer;
    const tileRight = (tileX + 0.5) * tileSizeX - buffer;
    const tileBottom = (tileY + 0.5) * tileSizeY - buffer;

    //const objLeft = object.x * tileSizeX - object.width / 2 + buffer;
    //const objTop = object.y * tileSizeY - object.height / 2 + buffer;
    //const objRight = objLeft + object.width - 2 * buffer;
    //const objBottom = objTop + object.height - 2 * buffer;

    const objLeft = object.x * tileSizeX - object.width / 2 + buffer;
    const objTop = object.y * tileSizeY - object.height / 2 + buffer;
    const objRight = objLeft + object.width - 2 * buffer;
    const objBottom = objTop + object.height - 2 * buffer;

    return !(
        objRight <= tileLeft ||
        objLeft >= tileRight ||
        objBottom <= tileTop ||
        objTop >= tileBottom
    );
}

function checkBulletTiles(x, y) {
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

function canMoveTo(x, y, object = player) {

    let tiles = [];
    if (object.type === 'bullet') tiles = checkBulletTiles(x * tileSizeX, y * tileSizeY, object.oldX, object.oldY);
    else tiles = checkTiles(x * tileSizeX, y * tileSizeY, object.direction);
    //tiles = checkTiles(x * tileSizeX, y * tileSizeY, object.direction)

    for (let tile of tiles) {

        let tileKey = `${object.layer},${tile.x},${tile.y}`;

        if (tile.x < 0 || tile.y < 0 || tile.y >= tilesY || tile.x >= tilesX) {
            return false; // Out of bounds = collision
        }

        if (isOverlappingTile(player, tile.x, tile.y) && object.type === 'object') {
            console.log('player detected!');
            return tryPushPlayer(player.x, player.y, object.direction, object.layer);
        }

        if (placedSprites[tileKey]) {
            let tileType = placedSprites[tileKey].type;

            if (object.type === 'bullet' && object.origin === 'player' && tileType === 'player') {
                return true;    // Bullet hit something (not itself or its owner)
            }

            //if (object === 'bullet' && tileType === 'object' && object.origin === 'object') return true; 
            if (tileType === 'player' && object.type === 'object') {
                console.log('object push. player: ', x, y);
                return tryPushTiles(player.x, player.y, object.direction, object.layer);
            }

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
                player.stats.coins++;
                console.log('Coins:', player.stats.coins);
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
                // Check to see if the player is fully on the tile before moving
                if (isOverlappingTile(player, tile.x, tile.y)) {
                    // Handle passage logic here
                    player.locked = true; // Lock player movement
                    let targetBoard = placedPassages[tileKey].data.board;
                    let passageColor = placedPassages[tileKey].color;
                    let colorKey = passageColor.join(','); // Create a unique key for the color
                    console.log('Switching to board:', targetBoard, 'with colorKey:', colorKey); // Debug log
                    switchBoard(targetBoard, colorKey); // Pass the color key to switchBoard
                    return false; // Prevent movement
                }
            }
        }

        //ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Debugging color
        //ctx.fillRect(tile.x * tileSizeX, tile.y * tileSizeY, tileSizeX, tileSizeY); // Debugging
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
    console.log(tiles);
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
        renderLayersToMainCanvas();
    }
}

function movePlayer(newLayer, newX, newY) {
    const oldKey = `${player.layer},${player.x},${player.y}`;
    const newKey = `${newLayer},${newX},${newY}`;

    // Update the global player object
    player.layer = newLayer;
    player.x = newX;
    player.y = newY;
    player.transported = true; // Mark player as moved

    // Update placedSprites
    if (placedSprites[oldKey]) {
        placedSprites[newKey] = placedSprites[oldKey]; // Move player sprite to the new key
        delete placedSprites[oldKey]; // Remove player sprite from the old key
    }

    console.log('Player moved to:', { layer: newLayer, x: newX, y: newY });

    // Redraw the board
    renderLayersToMainCanvas();
}

// #############################################
// ######## Events & loading functions #########
// #############################################

// Load board and replace sprite sheet
function handleLoadedBoard(spriteSheetData, boardData) {

    placedSprites = boardData;

    replaceSpriteSheet(spriteSheetData);

    placedObjects = loadObjectsFromGameData(placedSprites);
    console.log('Loaded Board', placedSprites);

    loaded = true;
    player = findPlayerSprite();
    player = { ...playerStats, ...player };

    //stats = player.stats;
    console.log('Loaded Stats', playerStats);
    console.log(player);

    drawBoard(); // Generate all layers
    renderLayersToMainCanvas(); // Draw them onto the main canvas
}

function handleLoadedGame(spriteSheetData, boardList, worldData) {
    boards = boardList; // Load the board list
    world = worldData; // Load the world data  
    replaceSpriteSheet(spriteSheetData); // Load the sprite sheet data

    // Extract passages for all boards
    for (const board in world) {
        loadPassagesFromGameData(world[board], board);
    }

    console.log('Loaded world data:', worldData);

    placedSprites = world[currentBoard]; // Get the current board from the world object
    placedObjects = loadObjectsFromGameData(placedSprites);
    placedPassages = worldPassages[currentBoard] || {}; // Load passages for the current board

    loaded = true;
    player = findPlayerSprite();
    console.log('Found player:', player);
    player = { ...playerStats, ...player };
    console.log('Loaded player:', player);

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
    currentBoard = board;

    placedSprites = world[currentBoard]; // Get the current board from the world object
    const spritesCopy = { ...placedSprites }; // Create a shallow copy
    placedObjects = loadObjectsFromGameData(spritesCopy);
    placedPassages = loadPassagesFromGameData(world[currentBoard], currentBoard); // Load passages from the current board

    // lookup passage color in placedPassages for a match
    for (const key in placedPassages) {
        const passage = placedPassages[key];
        const passageColorKey = passage.color.join(','); // Create a unique key for the passage color

        if (passageColorKey === colorKey) { // Compare the color keys
            const [layer, x, y] = key.split(',').map(Number); // Extract layer, x, y from the key
            movePlayer(layer, x, y); // Use movePlayer to update the player's position
            break; // Exit loop after finding the first match
        }
    }
    console.log(`Passages for board ${currentBoard}:`, placedPassages);
    player.locked = false; // Unlock player movement

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

    if (player.locked) return; // Prevent input if player is locked

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
        console.log('Player location:', player.layer, player.x, player.y);
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