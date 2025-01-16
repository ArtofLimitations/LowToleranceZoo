import { loadCombinedData } from './file.js';

// Canvas Configurations
var displayWidth = 1474;
var displayHeight = 800;
const canvas = document.getElementById('lowToleranceCanvas');
var scale = 1;
canvas.style.width = displayWidth + 'px';
canvas.style.height = displayHeight + 'px';
canvas.width = displayWidth * scale;
canvas.height = displayHeight * scale;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false

let filename = ''; // ############ File to load ###############

let lastTime = 0;  // Timing variables
const speed = 0.5; // Speed control: lower is slower, higher is faster
let position = 0;  // Position of the animated object

// board variables
let board = {};
let spritesheet = [];


export function animate(currentTime) {
    const deltaTime = currentTime - lastTime;

    if (deltaTime > 1000 / 60) { // 60 FPS cap
        // Update the position based on the speed and deltaTime
        position += speed * (deltaTime / 1000) * 60;
        lastTime = currentTime;
    }

    // Clear the canvas (optional, depends on what you're animating)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the animated object (a simple rectangle for example)
    ctx.fillStyle = 'red';
    ctx.fillRect(position, canvas.height / 2 - 25, 50, 50); // Draw rectangle at new position

    // Loop the animation
    requestAnimationFrame(animate);
}

function handleLoadedBoard (spriteSheetData, boardData) {
    board = boardData;
    spritesheet = spriteSheetData;
    console.log('Loaded Board');
}

function handleKeyboard(event) {
    const tileKey = `${currentLayer},${cursorX},${cursorY}`;
    console.log(event.key);

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

    switch (event.key.toLowerCase()) {
        case 'l':
            loadCombinedData(handleLoadedBoard);
            break;
    }
}

canvas.addEventListener('mousedown', (event) => { 
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left)); 
    const y = Math.floor((event.clientY - rect.top)); 
    position = x;
});

// Start the animation
requestAnimationFrame(animate);