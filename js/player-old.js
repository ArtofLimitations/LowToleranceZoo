import { loadCombinedData } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, drawPlayerSprite, drawSpriteImage } from './sprite.js';
import { createBullet } from './weapons.js';

// Canvas Configurations
const displayWidth = 1474;
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

// board variables
let board = {};
let loaded = false;

// Player
let player = {
    x: 10,
    y: 10,
    oldX: 10,
    oldY: 10,
    layer: 2,
};

const stepSize = 0.5; // Step size for player movement

let bulletArray = [];

let stats = {
    coins: 0,
    score: 0,
    lives: 3,
};

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
        
        lastTime = currentTime;
    }

    updatePlayer(deltaTime);
    updateWeapon(deltaTime);

    // Loop the animation
    requestAnimationFrame(animateGame);
}
// ############ End of main animation function ############ 

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

function updateWeapon(deltaTime) {

    bulletArray.forEach((bullet, index) => {
        //console.log('bullet: ', bullet.x / 32, bullet.y / 32);
        let oldTiles = getOverlappingTiles(bullet.x, bullet.y); // Get tiles before update
        bullet.update();
        let newTiles = getOverlappingTiles(bullet.x, bullet.y); // Get tiles after update

        let affectedTiles = [...new Set([...oldTiles, ...newTiles])]; // Combine old and new tiles

        //let reducedTiles = removeDuplicatesFromSet(affectedTiles); // Remove duplicates

        redrawTiles(affectedTiles); // Redraw the affected tiles

        //console.log('old: ', bullet.oldX, bullet.oldY);
        //bullet.draw();

        // Remove bullets that are inactive
        if (!bullet.active) {
            bulletArray.splice(index, 1);
        }
    });
    bulletArray = bulletArray.filter(bullet => bullet.active);
}

// Draw the grid of tiles
function drawBoard() {
    ctx.clearRect(0, 0, tilesX * tileSizeX + 1, tilesY * tileSizeY); // +1 to get rid of the line next to toolbar
    drawSpritesAt();
}

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

function drawSpritesAtTiles(tileCoordsArray) {
    // Collect all matching placedSprites keys and organize by layers
    let spritesByLayer = { 1: [], 2: [], 3: [] }; // Ensure all layers exist

    Object.keys(placedSprites)
        .map(key => {
            const [l, sx, sy] = key.split(',').map(Number);
            return { l, x: sx, y: sy, ...placedSprites[key] }; // Convert key to an object
        })
        .filter(sprite => tileCoordsArray.some(coord => coord.x === sprite.x && coord.y === sprite.y)) // Keep only matching tiles
        .forEach(sprite => {
            //if (!spritesByLayer[sprite.l]) spritesByLayer[sprite.l] = [];
            spritesByLayer[sprite.l].push(sprite); // Group by layer
        });

    // Create a new object with updated order
    /*
    const updatedSpritesByLayer = {
        1: spritesByLayer[1],
        2: spritesByLayer[2],
        3: [], // New empty layer inserted between 2 and 4 for bullets
        4: spritesByLayer[3], // Old layer 3 becomes layer 4
    };

    spritesByLayer = updatedSpritesByLayer;*/

    // Sort layer keys in ascending order
    const sortedLayers = Object.keys(spritesByLayer).map(Number).sort((a, b) => a - b);

    // Draw all sprites layer by layer
    for (const layer of sortedLayers) {
        if (hiddenLayers.has(layer)) continue; // Skip hidden layers

        for (const sprite of spritesByLayer[layer]) {
            drawSprite(sprite.x, sprite.y, tileSizeX, tileSizeY, sprite.sprite, sprite.color);
        
        }

        // Draw player after all other sprites on its layer
        if (layer === player.layer) {
            
        bulletArray.forEach(bullet => {
            //let bulletTiles = getOverlappingTiles(bullet.x, bullet.y);
            //if (bullet.active && bullet.origin === 'player') {
            //bulletTiles.forEach(tile => {
            //if (tile.y < tilesY && tile.x < tilesX) { // Ensure it's within bounds
            bullet.draw();
            //}
            //});
            //}
        });
            drawPlayerSprite(player.x, player.y, tileSizeX, tileSizeY, player.sprite, player.color);
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

/*function redrawTiles(tiles) {

    for (let tile of tiles) {
        //let tileX = tile.x * 32;
        //let tileY = tile.y * 32;
        clearTile(tile.x, tile.y); // Function to clear tile
        //drawSpritesAt(tile.x, tile.y, tileX, tileY); // Function to re-draw tile
        //ctx.beginPath();
        //ctx.fillStyle = 'rgba(146, 27, 27, 0.8)';
        //ctx.fillRect(tile.x * 32, tile.y * 32, 32, 32);
    }
    drawSpritesAtTiles(tiles);
}*/

function redrawTiles(tiles) {
    // Clear each tile first
    for (let tile of tiles) {
        clearTile(tile.x, tile.y);
    }

    drawSpritesAtTiles(tiles);
}

function clearTile(x, y) {
    ctx.clearRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY);
    //const key = `${player.layer},${x},${y}`;
    /*if (placedSprites[key]) {
        drawSpritesAt(x, y);
    }*/
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

function canMoveTo(x, y) {
    //return !placedSprites[`${player.layer},${x},${y}`] || placedSprites[`${player.layer},${x},${y}`].type !== "wall";
    //let tiles = getOverlappingTiles(x * 32, y * 32);
    let tiles = checkTiles(x * tileSizeX, y * tileSizeY, player.direction);

    //console.log(tiles);

    for (let tile of tiles) {
        let tileKey = `${player.layer},${tile.x},${tile.y}`;

        if (tile.x < 0 || tile.y < 0 || tile.y >= tilesY || tile.x >= tilesX) {
            return false; // Out of bounds = collision
        }
        if (placedSprites[tileKey]) {
            if (placedSprites[tileKey] && placedSprites[tileKey].type === 'wall') {
                return false; // Collision detected
            }
            if (placedSprites[tileKey] && placedSprites[tileKey].type === 'item') {
                stats.coins++; // for testing
                console.log('coins: ', stats.coins);
                delete placedSprites[tileKey];
                return true;
            }
        }
    }
    return true;
}

function updatePlayer(deltaTime) {
    accumulatedTime += deltaTime;
    if (accumulatedTime < moveSpeed) return; // Wait for the next frame
    accumulatedTime = 0;

    let oldTiles = getOverlappingTiles(player.x * 32, player.y * 32);
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

        let newTiles = getOverlappingTiles(player.x * 32, player.y * 32);

        let uniqueTiles = [...new Set([...oldTiles, ...newTiles])];
        //let uniqueTiles = [...new Set([...oldTiles])];

        placedSprites[newKey] = placedSprites[oldKey];
        delete placedSprites[oldKey];

        //console.log(uniqueTiles);
        redrawTiles(uniqueTiles);
        //drawSpritesAt(player.x, player.y);

        //console.log('player: ', player.x, player.y);
        //console.log('oldkey: ', oldKey);
        //console.log(player.direction);
    }
}

// Load board and replace spritesheet
function handleLoadedGame(spriteSheetData, boardData) {
    placedSprites = boardData;
    replaceSpriteSheet(spriteSheetData);

    console.log('Loaded Board', placedSprites);

    loaded = true;
    player = findPlayerSprite();
    stats = {
        coins: 0,
        score: 0,
        lives: 3
    };

    console.log(player);

    drawBoard(); //<------------------------------------- Draw function for entire board
}


document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
    if (event.key === "l") {
        loadCombinedData(handleLoadedGame);
    }

    switch (event.key) {
        case 'ArrowUp':
            player.direction = 'up';
            break;
        case 'ArrowDown':
            player.direction = 'down';
            break;
        case 'ArrowLeft':
            player.direction = 'left';
            break;
        case 'ArrowRight':
            player.direction = 'right';
            break;
        case ' ':
            // Shoot a bullet
            bulletArray.push(createBullet(player.x + .5, player.y + .5, player.direction, 16, 'white', 'player'));
            //bulletArray.push(createBullet(player.x, player.y, player.direction));
            break;
    }

});
document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

// Initiate

// Start the animation
requestAnimationFrame(animateGame);