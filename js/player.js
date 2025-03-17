import { loadCombinedData } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, drawPlayerSprite, drawSpriteImage, getSprite } from './sprite.js';
import { createBullet } from './weapons.js';
import { playerStats } from './player-stats.js';

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
const keys = {};
const tilesCanvas = new OffscreenCanvas(4 * tileSizeX, 4 * tileSizeY);
const tilesCtx = tilesCanvas.getContext('2d');

// board variables
let board = {};
let loaded = false;

// Player
let player = playerStats;

const stepSize = player.stepSize; // Step size for player movement

let bulletArray = [];

let stats = player.stats;

// File info
export let filename = ''; // ############ File to load ###############

// Timing
let fps = 60;
let lastTime = 0;  // Timing variables
const moveSpeed = 100; // Pixels per second
let accumulatedTime = 0;

// ############ Main animation function ############ 
export function animateGame(currentTime) {
    const deltaTime = currentTime - lastTime;

    if (deltaTime > 1000 / fps) { // 60 FPS cap
        // Update the position based on the speed and deltaTime

        //position += speed * (deltaTime / 1000) * 60;
         updateBullets(deltaTime);
        lastTime = currentTime;
    }
    //if (loaded) {
        //drawBoard();
      //  renderLayersToMainCanvas(); // Draw the layers onto the main canvas
    //}

    updatePlayer(deltaTime);
   
    
    // Loop the animation
    requestAnimationFrame(animateGame);
}
// ############ End of main animation function ############ 

function updateBullets(deltaTime) {

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

const layerCanvases = {}; // Stores canvases for layers
const layerContexts = {}; // Stores 2D contexts for layers

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
            ctx.drawImage(layerCanvases[layer], 0, 0);
        } else {
        console.warn(`Layer ${layer} is missing!`); // Debugging
        }
        if (layer === player.layer) {
            //console.log(player);
            ctx.drawImage(getSprite(player.sprite, player.color), player.x * tileSizeX, player.y * tileSizeY);
            //drawPlayerSprite(player.x, player.y, tileSizeX, tileSizeY, player.sprite, player.color);
            bulletArray.forEach (bullet => {
                bullet.draw(); 
            });
        }
    }
}

function drawSpriteToCanvas(ctx, x, y, tileSizeX, tileSizeY, sprite, color) {
    drawSprite(x, y, tileSizeX, tileSizeY, sprite, color, ctx); // Draw sprite on given canvas
}

// Draw the grid of tiles
/*function drawBoard() {
    ctx.clearRect(0, 0, tilesX * tileSizeX + 1, tilesY * tileSizeY); // +1 to get rid of the line next to toolbar
    drawSpritesAt();
}*/

function drawSpritesAt(x = null, y = null) {
    // Collect and sort all placed sprite keys by layer (ascending)
    const sortedKeys = Object.keys(placedSprites)
        .map(key => key.split(',').map(Number)) // Convert "l,x,y" to [l, x, y]
        //.sort(([l1], [l2]) => l1 - l2); // Sort by layer (ascending)
        .sort(([l1, , y1], [l2, , y2]) => l1 - l2 || y1 - y2); // Sort by layer, then by Y-position

    for (const [l, sx, sy] of sortedKeys) {
        // Skip hidden layers
        if (hiddenLayers.has(l)) continue;

        // If x and y are provided, only draw the sprite(s) at (x, y)
        if (x !== null && y !== null && (sx !== x || sy !== y)) continue;

        const spriteInfo = placedSprites[`${l},${sx},${sy}`];
        if (spriteInfo) {
            if (spriteInfo.type === 'player') {
                // Use player's actual position instead of tile position
                drawPlayerSprite(player.x, player.y, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
            } else {
                drawSprite(sx, sy, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
            }
        }
    }
}

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

function redrawTiles(tiles) {
    // Clear each tile first
    for (let tile of tiles) {
        clearTile(tile.x, tile.y);
    }

    drawSpritesAtTiles(tiles);
}

function clearTile(x, y) {
    ctx.clearRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY);
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
/*
function canMoveTo(x, y, object = player) {
    //return !placedSprites[`${player.layer},${x},${y}`] || placedSprites[`${player.layer},${x},${y}`].type !== "wall";
    //let tiles = getOverlappingTiles(x * 32, y * 32);
    if (object.type === 'bullet') {
        x = x - .5;
        y = y - .5;
    }
    let tiles = checkTiles(x * tileSizeX, y * tileSizeY, object.direction);

    console.log(tiles);

    for (let tile of tiles) {
        let tileKey = `${object.layer},${tile.x},${tile.y}`;

        if (tile.x < 0 || tile.y < 0 || tile.y >= tilesY || tile.x >= tilesX) {
            return false; // Out of bounds = collision
        }
        if (placedSprites[tileKey]) {
            if (placedSprites[tileKey] && placedSprites[tileKey].type === 'wall' || placedSprites[tileKey].type === 'break') {
                if (object.type === 'bullet' && placedSprites[tileKey].type === 'break') {
                    delete placedSprites[tileKey];
                    updateTile(object.layer, tile.x, tile.y);
                }
                return false; // Collision detected
            }
            if (placedSprites[tileKey] && placedSprites[tileKey].type === 'item' && object.type === 'player') {
                stats.coins++; // for testing
                console.log('coins: ', stats.coins);
                delete placedSprites[tileKey];
                updateTile(player.layer, tile.x, tile.y);
                return true;
            }
            if (placedSprites[tileKey] && placedSprites[tileKey].type === 'push') {
                let checkX = tile.x;
                let checkY = tile.y;
                switch (object.direction) {
                    case 'up':
                        checkY -= 1;
                        break;
                    case 'down':
                        checkY += 1;
                        break;
                    case 'left':
                        checkX -= 1;
                        break;
                    case 'right':
                        checkX += 1;
                        break;
                }
                let newTiles = checkTiles(checkX, y * checkY, object.direction);
                if (placedSprites[`${object.layer},${newTiles}`]) {
                    return false;
                } else {
                    placedSprites[tileKey] = placedSprites[`${object.layer},${newTiles}`];
                    delete placedSprites[tileKey];
                    updateTile(player.layer, tile.x, tile.y);
                    return true;
                }
            }
        }
    }
    return true;
}*/
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

            // Collision with walls or unbreakable objects
            if (tileType === 'wall' || tileType === 'break') {
                if (object.type === 'bullet' && tileType === 'break') {
                    delete placedSprites[tileKey];
                    updateTile(object.layer, tile.x, tile.y);
                }
                return false;
            }

            // Picking up an item
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
    }

    return true; // Movement allowed
}


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

        //drawLayersAtTiles(uniqueTiles);
        //redrawLayers(player.x * 32, player.y * 32);
        //drawTileAt(player.x, player.y, player.layer); // Updates a single tile at (5,5) on layer 2
        renderLayersToMainCanvas();
        //redrawTiles(uniqueTiles);
    }
}

// Load board and replace spritesheet
function handleLoadedGame(spriteSheetData, boardData) {
    placedSprites = boardData;
    replaceSpriteSheet(spriteSheetData);

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

document.addEventListener("keydown", (event) => {
    keys[event.key] = true;

    if (event.key === "l") {
        loadCombinedData(handleLoadedGame);
    }

    if (event.key === " ") { // Spacebar to shoot
        bulletArray.push(createBullet(player.x + 0.5, player.y + 0.5, player.direction));
    }

    updateDirection(); // Update direction based on keys held
});

document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
    updateDirection(); // Update direction when key is released
});

// Function to determine the correct direction
function updateDirection() {
    if (keys["ArrowUp"]) {
        player.direction = "up";
    } else if (keys["ArrowDown"]) {
        player.direction = "down";
    } else if (keys["ArrowLeft"]) {
        player.direction = "left";
    } else if (keys["ArrowRight"]) {
        player.direction = "right";
    }
}

// Initiate

// Start the animation
requestAnimationFrame(animateGame);