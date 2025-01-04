import { toolbar, toolbarClicked } from './toolbar.js';
import { drawSprite } from './sprite.js';
import { editSprite, updateSpriteData } from './sprite-editor.js';
import { getSpriteSheet } from './sprite-sheet.js';
import { pickColor, currentColors, updateColor } from './palette.js';
import { saveBoard, loadBoard } from './file.js';
import { editObject } from './object-editor.js';
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
    const tileSizeX = 32;                // Single tile size
    const tileSizeY = 32;
    let placedSprites = {};              // Store the positions of placed sprites (as key-value pairs)
    //let spriteSheet = getSpriteSheet();  // Store Sprites
    let tilesX = 36;                     // Board width and height
    let tilesY = 25;
    let currentSprite = 1;               // Sprite to draw. Default = 1
    let currentLayer = 2;                // Layer to draw sprite on. 1 = floor 2 = default 3 = ceiling
    let [cursorX, cursorY] = [9, 4];     // Keyboard cursor
    let tileSetLength = 300;             // Size of tileset
    let colors = currentColors;          // colors selected from palette
    let key = {
        ctrl: false,
        shift: false,
        alt: false
    };
    let mouse = {
        x: 0,
        y: 0,
        down: false,
        button: 0,
        mode: 'draw',
        lastClick: 0,
        clickDelay: 50
    };
    let player = {
        x: 20,
        y: 20,
        layer: 2
    }

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
        drawCursor();
        // Draw toolbar from toolbar.js
        toolbar(currentSprite, colors, currentLayer, mouse);
    }

    // Draw a single tile to create a grid
    function drawTile(x, y) {
        const posX = x * tileSizeX;
        const posY = y * tileSizeY;
        //console.log(`tile:${x},${y} cursor:${cursorX},${cursorY}`);
        ctx.lineWidth = 1;
        if (x === cursorX && y === cursorY) { // Tile = red if cursor at pos
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
    /*function drawSprites() {
        for (const key in placedSprites) {
            const [x, y] = key.split(',').map(Number);
            if (x < tilesX && y < tilesY) drawSprite(x, y, tileSizeX, tileSizeY, placedSprites[`${x},${y}`].sprite, placedSprites[`${x},${y}`].color); // draw the sprite image data from sprite.js
        }
    }*/

    function drawSprites() {
        // Collect keys and sort by layer (ascending)
        const sortedKeys = Object.keys(placedSprites)
            .map(key => key.split(',').map(Number)) // Convert to arrays of [l, x, y]
            .sort(([l1], [l2]) => l1 - l2); // Sort by the layer (l1, l2)

        for (const [l, x, y] of sortedKeys) {
            if (x < tilesX && y < tilesY) {
                const spriteInfo = placedSprites[`${l},${x},${y}`];
                drawSprite(x, y, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
            }
        }
    }

    function drawCursor() {
        const posX = cursorX * tileSizeX;
        const posY = cursorY * tileSizeY;
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 10, 10, 0.6)';
        ctx.strokeRect(posX, posY, tileSizeX, tileSizeY);
    }

    // Get tile coordinates from mouse click
    function getTileCoordinates(mouseX, mouseY) {
        const x = Math.floor(mouseX / tileSizeX);
        const y = Math.floor(mouseY / tileSizeY);
        return { x, y };
    }

    // grab the sprite at cursor when Enter key or right click
    function grabSprite(tileKey) {
        if (placedSprites[tileKey] !== undefined) {
            if (!key.ctrl) { // If the ctrl key isn't pressed then grab the sprite and color else just color
                currentSprite = placedSprites[tileKey].sprite;
                updateSpriteData(currentSprite);
            }
            colors = placedSprites[tileKey].color; // color grab
            console.log(currentSprite);
            updateColor(colors);
            toolbar(currentSprite, colors, currentLayer, mouse);
        }
    }

    // Handle placing/removing sprites
    function handleTileClick(event) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const { x, y } = getTileCoordinates(mouseX, mouseY);
        const tileKey = `${currentLayer},${x},${y}`;
        [cursorX, cursorY] = [x, y];
        console.log(`mouse: cursor ${cursorX},${cursorY}`);
        switch (event.button) {
            case 2:
                grabSprite(tileKey);
                break;
            case 0:
                if (placedSprites[tileKey]) {
                    // Remove sprite if it exists
                    delete placedSprites[tileKey];
                } else {
                    // Place sprite
                    placedSprites[tileKey] = {
                        sprite: currentSprite, // add current selected sprite (number)
                        image: null,
                        color: colors          // add current colors from palette (array)
                    };
                }
        }
        drawBoard();
    }

    function handleLoadedBoard(data) {
        console.log("Data loaded into application:", data);

        placedSprites = data;
        drawBoard();
    }

    function handleClick(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        mouse.x = Math.floor(x / tileSizeX);
        mouse.y = Math.floor(y / tileSizeY);
        mouse.down = true;
        mouse.button = event.button;

        if (x <= tilesX * tileSizeX) { // UPDATE
            handleTileClick(event);
        }
        else {
            // handle toolbar clicks from toolbar.js
            toolbarClicked(x, y);
            colors = currentColors;
        }
    }

    function handleMouseMove(event) {
        // detect possible changes in mouse position
        if (mouse.down) {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((event.clientX - rect.left) / tileSizeX);
            const y = Math.floor((event.clientY - rect.top) / tileSizeY);

            if (mouse.x != x || mouse.y != y) {
                mouse.x = x;
                mouse.y = y;

                const now = Date.now(); // Current time in milliseconds

                //handleTileClick(event);
                if (mouse.mode === 'draw' && // if mouse mode is draw and click is within drawing area and click delay is long enough
                    mouse.x >= 0 && 
                    mouse.y >= 0 && 
                    mouse.x < tilesX && 
                    mouse.y < tilesY &&
                    now - mouse.lastClick > mouse.clickDelay) {
                    handleTileClick(event);
                    mouse.lastClick = now; // Update the last click time
                }
            }
        }
    }

    function handleKeyboard(event) {
        const tileKey = `${currentLayer},${cursorX},${cursorY}`;

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
                //const tileKey = `${cursorX},${cursorY}`;
                if (placedSprites[tileKey]) {
                    // Remove sprite if it exists
                    delete placedSprites[tileKey];
                } else {
                    // Place sprite
                    placedSprites[tileKey] = {
                        sprite: currentSprite, // add current selected sprite (number)
                        layer: 'default',      // layer UPDATE
                        color: colors          // add current colors from palette (array)
                    };
                };
                drawBoard(); // Refresh board
                //drawSprites();
                break;
            case 'Enter': // add layers later
                grabSprite(tileKey);
                break;
        }

        switch (event.key.toLowerCase()) {
            case 'e':
                removeMainEvents();
                editSprite(currentSprite); // Open the sprite editor from sprite-editor.js
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
            case 'b':
                if (!event.ctrlKey) saveBoard(placedSprites);
                break;
            case 'o':
                editObject();
                break;
            case '1':
                currentLayer = 1;
                break;
            case '2':
                currentLayer = 2;
                break;
            case '3':
                currentLayer = 3;
                break;
        }

        if (event.ctrlKey || event.metaKey) {
            // Handle key combinations for both Windows/Linux (Ctrl) and Mac (Cmd)
            key.ctrl = true;
            switch (event.key.toLowerCase()) { // Check the key
                case "b": // Handle 'Ctrl + B'
                    loadBoard(handleLoadedBoard);
                    break;
            }
        }
        console.log(`key: cursor ${cursorX},${cursorY}`);
        console.log('layer: ', currentLayer);
        drawBoard(); // Redraw the board and cursor
    }

    window.addMainEvents = function () {
        // Handle events for keyboard, mouse, etc
        canvas.addEventListener('mousedown', handleClick);
        canvas.addEventListener('mouseup', () => { mouse.down = false; });
        canvas.addEventListener("mousemove", handleMouseMove);
        //canvas.addEventListener('mouseleave', () => { mouse.down = false; });

        // handles keypresses
        canvas.addEventListener('keydown', handleKeyboard);
        canvas.addEventListener('keyup', () => { key = { ctrl: false, shift: false, alt: false } });
        colors = currentColors;
        drawBoard();
        canvas.focus();
    }

    window.removeMainEvents = function () {
        canvas.removeEventListener('mousedown', handleClick);
        canvas.removeEventListener('mouseup', () => { });
        canvas.removeEventListener("mousemove", handleMouseMove);

        canvas.removeEventListener('keydown', handleKeyboard);
        canvas.removeEventListener('keyup', () => { });
    }

    //document.getElementById('saveBoard').addEventListener('click', saveBoard(placedSprites));

    // Initial canvas setup
    addMainEvents();
    toolbar(currentSprite, colors, currentLayer, mouse);
    drawBoard();
});