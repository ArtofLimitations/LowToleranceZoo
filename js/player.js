import { loadCombinedData } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, adjustColor, convertToImageData, drawSpriteImage } from './sprite.js';

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
let currentLayer = 2;
let spritesheet = [];
let placedSprites = {};
const tileSizeX = 32;                // Single tile size
const tileSizeY = 32;
const tilesX = 36;                     // Board width and height
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
    oldY: 10
};

// File info
export let filename = ''; // ############ File to load ###############

// Timing
let fps = 60;
let lastTime = 0;  // Timing variables
const speed = 5.5; // Speed control: lower is slower, higher is faster
let position = 0;  // Position of the animated object

export function animate(currentTime) {
    const deltaTime = currentTime - lastTime;

    if (deltaTime > 1000 / fps) { // 60 FPS cap
        // Update the position based on the speed and deltaTime
        position += speed * (deltaTime / 1000) * 60;
        lastTime = currentTime;
    }

    /* Clear the canvas (optional, depends on what you're animating)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw an animated square for TESTING
    ctx.fillStyle = 'red';
    ctx.fillRect(position, canvas.height / 2 - 25, 50, 50); // Draw rectangle at new position
    */

    drawBoard();

    // Loop the animation
    requestAnimationFrame(animate);
}

function drawPlayer() {

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

// Draw the grid of tiles
function drawBoard() {
    //console.log('drawing whole board');
    ctx.clearRect(0, 0, tilesX * tileSizeX + 1, tilesY * tileSizeY); // +1 to get rid of the line next to toolbar
    drawSpritesAt();
    drawPlayer();
    //toolbar(currentSprite, colors, currentLayer, mouse);
}

function drawSpritesAt(x = null, y = null) {
    // Collect and sort all placed sprite keys by layer (ascending)
    const sortedKeys = Object.keys(placedSprites)
        .map(key => key.split(',').map(Number)) // Convert "l,x,y" to [l, x, y]
        .sort(([l1], [l2]) => l1 - l2); // Sort by layer (ascending)

    for (const [l, sx, sy] of sortedKeys) {
        // Skip hidden layers
        if (hiddenLayers.has(l)) continue;

        // If x and y are provided, only draw the sprite(s) at (x, y)
        if (x !== null && y !== null && (sx !== x || sy !== y)) continue;

        const spriteInfo = placedSprites[`${l},${sx},${sy}`];
        if (spriteInfo) {
            drawSprite(sx, sy, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
        }
    }
}

// Load board and replace spritesheet
function handleLoadedGame(spriteSheetData, boardData) {
    placedSprites = boardData;
    replaceSpriteSheet(spriteSheetData);
    console.log('Loaded Board', placedSprites);
    loaded = true;
    player = findPlayerSprite();
    console.log(player);
    drawBoard(); //<------------------------------------- Draw function for entire board
}

function handleKeyboard(event) {
    let newX = player.x;
    let newY = player.y;

    if (keys["ArrowUp"] && canMoveTo(player.x, player.y - 1)) newY--;
    if (keys["ArrowDown"] && canMoveTo(player.x, player.y + 1)) newY++;
    if (keys["ArrowLeft"] && canMoveTo(player.x - 1, player.y)) newX--;
    if (keys["ArrowRight"] && canMoveTo(player.x + 1, player.y)) newX++;

    switch (keys.toLowerCase()) {
        case 'l':
            loadCombinedData(handleLoadedGame);
            break;
    }

    if (newX !== player.x || newY !== player.y) {
        const oldKey = `${player.layer},${player.x},${player.y}`;
        const newKey = `${player.layer},${newX},${newY}`;

        placedSprites[newKey] = placedSprites[oldKey];
        delete placedSprites[oldKey];

        player.x = newX;
        player.y = newY;

        drawTile(player.x, player.y);
        clearTile(player.x - (newX - player.x), player.y - (newY - player.y));
    }
    /*const tileKey = `${currentLayer},${player.x},${player.y}`;
    console.log(event.key);
    player.oldX = player.x;
    player.oldY = player.y
    */
    /*
    switch (event.key) {

        case 'ArrowUp':
            if (player.y > 0) player.y -= 1; // Move up
            break;
        case 'ArrowDown':
            if (player.y < tilesY - 1) player.y += 1; // Move down
            break;
        case 'ArrowLeft':
            if (player.x > 0) player.x -= 1; // Move left
            break;
        case 'ArrowRight':
            if (player.x < tilesX - 1) player.x += 1; // Move right
            break;
    }

    if (loaded) {
        if (placedSprites[tileKey]) {
            //if (placedSprites[tileKey].type !== 'wall') {
                delete placedSprites[tileKey];
                //placedSprites[tileKey] = player;
                placedSprites[tileKey] = player;
                console.log('updated player: ',player);
            //}
        }
    }

    switch (event.key.toLowerCase()) {
        case 'l':
            loadCombinedData(handleLoadedGame);
            break;
    }
            */
}

canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left));
    const y = Math.floor((event.clientY - rect.top));
    position = x;
});

//canvas.addEventListener('keydown', handleKeyboard);

// Initiate


// Start the animation
requestAnimationFrame(animate);
