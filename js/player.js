import { loadCombinedData } from './file.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { drawSprite, drawPlayerSprite, drawSpriteImage } from './sprite.js';

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
const stepSize = 0.25;

// File info
export let filename = ''; // ############ File to load ###############

// Timing
let fps = 60;
let lastTime = 0;  // Timing variables
const speed = 5.5; // Speed control: lower is slower, higher is faster
let position = 0;  // Position of the animated object
const moveSpeed = 100; // Pixels per second
let accumulatedTime = 0;

export function animateGame(currentTime) {
    const deltaTime = currentTime - lastTime;

    if (deltaTime > 1000 / fps) { // 60 FPS cap
        // Update the position based on the speed and deltaTime
        
        //position += speed * (deltaTime / 1000) * 60;
        lastTime = currentTime;
    }

    /* Clear the canvas (optional, depends on what you're animating)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    Draw an animated square for TESTING
    ctx.fillStyle = 'red';
    ctx.fillRect(position, canvas.height / 2 - 25, 50, 50); //Draw rectangle at new position
    drawBoard();*/
    
    updatePlayer(deltaTime);

    // Loop the animation
    requestAnimationFrame(animateGame);
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
    //drawPlayer();
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
            if (spriteInfo.type !== 'player') drawSprite(sx, sy, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
            else drawPlayerSprite(sx * 32, sy * 32, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
        }
    }
}

function clearTile(x, y) {
    ctx.clearRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY);
    const key = `${player.layer},${x},${y}`;
    if (placedSprites[key]) {
        drawSpritesAt(x, y);
    }
}

function canMoveTo(x, y) {
    return !placedSprites[`${player.layer},${x},${y}`] || placedSprites[`${player.layer},${x},${y}`].type !== "wall";
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

function updatePlayer(deltaTime) {
    accumulatedTime += deltaTime;
    if (accumulatedTime < moveSpeed) return;
    accumulatedTime = 0;

    let newX = player.x;
    let newY = player.y;
    let oldX = player.x;
    let oldY = player.y;

    if (keys["ArrowUp"] && canMoveTo(player.x, player.y - 1)) newY--;
    if (keys["ArrowDown"] && canMoveTo(player.x, player.y + 1)) newY++;
    if (keys["ArrowLeft"] && canMoveTo(player.x - 1, player.y)) newX--;
    if (keys["ArrowRight"] && canMoveTo(player.x + 1, player.y)) newX++;
/*
    switch (true) {
        case keys["ArrowUp"] && canMoveTo(player.x, player.y - stepSize * tileSizeY):
            newY -= stepSize * tileSizeY;
            break;
        case keys["ArrowDown"] && canMoveTo(player.x, player.y + stepSize * tileSizeY):
            newY += stepSize * tileSizeY;
            break;
        case keys["ArrowLeft"] && canMoveTo(player.x - stepSize * tileSizeX, player.y):
            newX -= stepSize * tileSizeX;
            break;
        case keys["ArrowRight"] && canMoveTo(player.x + stepSize * tileSizeX, player.y):
            newX += stepSize * tileSizeX;
            break;
    }*/

    if (newX !== player.x || newY !== player.y) {
        const oldKey = `${player.layer},${player.x},${player.y}`;
        const newKey = `${player.layer},${newX},${newY}`;

        placedSprites[newKey] = placedSprites[oldKey];
        delete placedSprites[oldKey];

        player.x = newX;
        player.y = newY;

        drawSpritesAt(player.x, player.y);
        clearTile(oldX, oldY);
        drawSpritesAt(oldX, oldY);
        console.log(player.x,player.y);
        
        //clearTile(player.x - (newX - player.x), player.y - (newY - player.y));
        console.log('clear: ',player.x - (newX - player.x), player.y - (newY - player.y));
    }
}

canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left));
    const y = Math.floor((event.clientY - rect.top));
    position = x;
});

document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === "l") {
        loadCombinedData(handleLoadedGame);
    }});
document.addEventListener("keyup", (e) =>  {
    keys[e.key] = false

});

//canvas.addEventListener('keydown', handleKeyboard);

// Initiate


// Start the animation
requestAnimationFrame(animateGame);
