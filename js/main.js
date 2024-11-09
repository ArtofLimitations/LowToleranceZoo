import { toolbar, toolbarClicked } from './toolbar.js';
import { drawSprite } from './sprite.js';
import { editSprite, updateSpriteData } from './sprite-editor.js';
import { getSpriteSheet } from './sprite-sheet.js';
import { pickColor, currentColors } from './palette.js';
//import { handleTileClick } from './tiles.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Low Tolerance Zoo');

    // Canvas Configurations
    var displayWidth = 1474;
    var displayHeight = 800;
    const canvas = document.getElementById('tileCanvas');
    var scale = 1;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    canvas.width = displayWidth * scale;
    canvas.height = displayHeight * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false

    // Z+ Configurations
    const tileSizeX = 32;             // Single tile size
    const tileSizeY = 32;
    const toolBarSize = 320;          // Right side toolbar sized in tiles
    const placedSprites = {}
    /*const placedSprites = {         // Store the positions of placed sprites (as key-value pairs)
        ceiling: {},
        default: {},
        floor:   {}
    };       */                         
    let spriteSheet = {};           // Store Sprites
    let tilesX = 36;                  // Board width and height
    let tilesY = 25;
    let currentSprite = 1;            // Sprite to draw. Default = 1
    let [cursorX, cursorY] = [9, 4];  // Keyboard cursor
    let tileSetLength = 300;            // Size of tileset
    let colors = [];

    // Draw the grid of tiles
    function drawBoard() {
        //ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.clearRect(0, 0, tilesX * tileSizeX + 1, tilesY * tileSizeY);
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                drawTile(x, y);
            }
        }
        drawSprites();
        // Draw toolbar from toolbar.js
        toolbar(toolBarSize, currentSprite);
    }

    // Draw a single tile
    function drawTile(x, y) {
        const posX = x * tileSizeX;
        const posY = y * tileSizeY;
        //console.log(`tile:${x},${y} cursor:${cursorX},${cursorY}`);
        ctx.lineWidth = 1;
        if (x === cursorX && y === cursorY) { // Tile = red if cursor pos
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 10, 10, 0.6)';
        } else {
            ctx.beginPath();
            //ctx.strokeStyle = 'rgba(90, 100, 10, 0.1)';
            ctx.strokeStyle = 'rgba(255, 111, 94, 0.1)';
        }
        ctx.strokeRect(posX, posY, tileSizeX, tileSizeY);
    }

    // Draw placed sprites to screen
    function drawSprites() {
        for (const key in placedSprites) {
            const [x, y] = key.split(',').map(Number);
            if (x < tilesX && y < tilesY) drawSprite(x, y, tileSizeX, tileSizeY, placedSprites[`${x},${y}`]); // draw the sprite image data from sprite.js
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
        [cursorX, cursorY] = [x, y];
        console.log(`mouse: cursor ${cursorX},${cursorY}`);

        if (placedSprites[tileKey]) {
            // Remove sprite if it exists
            delete placedSprites[tileKey];
        } else {
            // Place sprite
            placedSprites[tileKey] = currentSprite;       // current sprite UPDATE
        }
        drawBoard();
        //drawSprites();
        //console.log(tileKey);
        //console.log(placedSprites[tileKey]);
    }

    function handleClick(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (x <= tilesX * tileSizeX) {
            handleTileClick(event);
        }
        else {
            // handle toolbar clicks from toolbar.js
            toolbarClicked(x, y, toolBarSize);
        }
    }

    function handleKeyboard(event) {

        switch (event.key) {

            case 'ArrowUp':
                if (cursorY > 0) cursorY -= 1; // Move up
                break;
            case 'ArrowDown':
                if (cursorY < tilesY - 1) cursorY += 1; // Move down
                break;
            case 'ArrowLeft':
                if (cursorX > 0) cursorX -= 1; // Move left
                break;
            case 'ArrowRight':
                if (cursorX < tilesX - 1) cursorX += 1; // Move right
                break;
            case ' ':
                const tileKey = `${cursorX},${cursorY}`;
                if (placedSprites[tileKey]) {
                    // Remove sprite if it exists
                    delete placedSprites[tileKey];
                } else {
                    // Place sprite
                    placedSprites[tileKey] = currentSprite;
                }
                drawBoard(); // Refresh board
                //drawSprites();
                break;
            case 'e':
                removeMainEvents(); // Open the sprite editor from sprite-editor.js
                editSprite(currentSprite);
                break;
            case 'c':
                removeMainEvents();
                pickColor(); // Open color picker from palette.js
                break;
            case '=':
                if (currentSprite < tileSetLength) currentSprite += 1;
                console.log('current sprite: ' + currentSprite);
                updateSpriteData(currentSprite);
                break;
            case '-':
                if (currentSprite > 1) currentSprite -= 1;
                console.log('current sprite: ' + currentSprite);
                updateSpriteData(currentSprite);
                break;
        }
        console.log(`key: cursor ${cursorX},${cursorY}`);
        drawBoard(); // Redraw the board and cursor
    }

    window.addMainEvents = function () {
        // Handle events for keyboard, mouse, etc
        canvas.addEventListener('click', handleClick);        // canvas.removeEventListener('click', myFunction);
        //canvas.addEventListener('mouseup', () => { mouse.down = false; });
        //canvas.addEventListener("mousemove", handleMouseMove);
        //canvas.addEventListener('mouseleave', () => { mouse.down = false; });

        // handles keypresses 
        canvas.addEventListener('keydown', handleKeyboard);
        colors = currentColors;
        drawBoard();
        canvas.focus();
    }

    function removeMainEvents () {
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('keydown', handleKeyboard);
    }

    // Initial canvas setup
    addMainEvents();
    spriteSheet = getSpriteSheet();
    colors = currentColors;
    toolbar(toolBarSize);
    drawBoard();
});