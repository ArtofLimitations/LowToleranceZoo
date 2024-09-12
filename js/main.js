// main.js
import { toolbar } from './toolbar.js';
import { drawSprite } from './sprite.js';
//import { handleTileClick } from './tiles.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Z+');

    const canvas = document.getElementById('tileCanvas');
    const ctx = canvas.getContext('2d');

    // Configurations
    const tileSizeX = 32;
    const tileSizeY = 32;
    const toolBarSize = 10; // Right side toolbar sized in tiles
    const placedSprites = {};  // Store the positions of placed sprites (as key-value pairs)
    let tilesX, tilesY;
    let boardSizeX, boardSizeY = 50;

    // Resize the canvas and calculate the number of tiles
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        tilesX = Math.floor(canvas.width / tileSizeX) - toolBarSize;
        tilesY = Math.floor(canvas.height / tileSizeY);
        drawTiles();
    }

    // Draw the grid of tiles
    function drawTiles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                drawTile(x, y);
            }
        }
        drawSprites();
        // Draw toolbar from toolbar.js
        toolbar(toolBarSize, tileSizeY);
    }

    // Draw a single tile
    function drawTile(x, y) {
        const posX = x * tileSizeX;
        const posY = y * tileSizeY;
        ctx.strokeStyle = '#666';
        ctx.strokeRect(posX, posY, tileSizeX, tileSizeY);
    }

    // Draw placed sprites to screen
    function drawSprites () {
        for (const key in placedSprites) {
            const [x, y] = key.split(',').map(Number);
            if (x < tilesX && y < tilesY) drawSprite(x, y, tileSizeX, tileSizeY);
        }
    }

    // Get tile coordinates from mouse click
    function getTileCoordinates(mouseX, mouseY) {
        const x = Math.floor(mouseX / tileSizeX);
        const y = Math.floor(mouseY / tileSizeY);
        return { x, y };
    }

    // Handle placing/removing sprites
    function handleTileClick(event) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const { x, y } = getTileCoordinates(mouseX, mouseY);
        const tileKey = `${x},${y}`;

        if (placedSprites[tileKey]) {
            // Remove sprite if it exists
            delete placedSprites[tileKey];
        } else {
            // Place sprite
            placedSprites[tileKey] = 1;
        }
        drawSprites();
        console.log(tileKey);
        console.log(placedSprites[tileKey]);
    }

    // Handle window resizing
    window.addEventListener('resize', resizeCanvas);
    // Handle mouse click for drawing sprites
    canvas.addEventListener('click', handleTileClick);

    // Initial canvas setup
    resizeCanvas();
    toolbar(toolBarSize, tileSizeY);
});