import { toolbar } from './toolbar.js';
import { drawSprite, adjustColor, createDataURL, convertToImageData } from './sprite.js';
import { editSprite, updateSpriteData } from './sprite-editor.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { pickColor, currentColors, updateColor } from './palette.js';
import { saveBoard, loadBoard, saveCombinedData, loadCombinedData } from './file.js';
import { editObject } from './object-editor.js';
//import { animate } from './player.js';
//import { handleTileClick } from './tiles.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Low Tolerance Zoo');

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

    const editorToolbar = document.getElementById('lowToleranceToolbar');

    // Low Tolerance Zoo editor Configurations
    const tileSizeX = 32;                // Single tile size
    const tileSizeY = 32;
    let hiddenLayers = new Set();        // Set to hold hidden layers
    let placedSprites = {};              // Store the positions of placed sprites (as key-value pairs)
    let tilesX = 36;                     // Board width and height
    let tilesY = 25;
    let currentSprite = 1;               // Sprite to draw. Default = 1
    let currentLayer = 2;                // Layer to draw sprite on. 1 = floor 2 = default 3 = ceiling
    let [cursorX, cursorY] = [9, 4];     // Keyboard cursor
    let tileSetLength = 300;             // Size of tileset
    let colors = currentColors;          // colors selected from palette
    let key = { ctrl: false, shift: false, alt: false, lastClick: 0, clickDelay: 100 };     // keyboard status object. click delay in ms
    let mouse = {
        x: cursorX, y: cursorY, oldX: cursorX, oldY: cursorY, down: false,
        button: 0, mode: 'draw', lastClick: 0, clickDelay: 50
    };                                                                                      // mouse status object. click delay. see handleMouseMove function. click delay in ms
    let player = { x: 20, y: 20, oldX: 20, oldY: 20, layer: 2 }                             // basic stats for player
    let type = 'wall';                                                                      // default type for placed sprites

    function getSpriteImage() {
        const data = getDataFromSheet(currentSprite); // from sprite-sheet.js
        return data;
    }

    // DRAW EVERY TILE

    // Draw the grid of tiles
    function drawBoard() {
        //console.log('drawing whole board');
        ctx.clearRect(0, 0, tilesX * tileSizeX + 1, tilesY * tileSizeY); // +1 to get rid of the line next to toolbar
        /*for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                drawTile(x, y);
            }
        }*/
        drawSprites();
        drawCursor();
        //toolbar(currentSprite, colors, currentLayer, mouse);
    }

    function drawSprites() {
        // Collect keys and sort by layer (ascending)
        const sortedKeys = Object.keys(placedSprites)
            .map(key => key.split(',').map(Number)) // Convert to arrays of [l, x, y]
            .sort(([l1], [l2]) => l1 - l2); // Sort by the layer (l1, l2)

        for (const [l, x, y] of sortedKeys) {
            // Skip the layer if it is in the hiddenLayers set
            if (hiddenLayers.has(l)) continue;

            if (x < tilesX && y < tilesY) {
                const spriteInfo = placedSprites[`${l},${x},${y}`];
                drawSprite(x, y, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color); // draw sprite from sprite.js with array data
            }
        }
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

    // DRAW SINGLE TILE

    function DrawSingleTile(x, y) {
        ctx.clearRect(mouse.oldX * tileSizeX, mouse.oldY * tileSizeY, tileSizeX, tileSizeY);
        //ctx.clearRect(x, y, tileSizeX, tileSizeY);
        drawSpritesAt(mouse.oldX, mouse.oldY);
        drawSpritesAt(x, y);
        drawCursor();
    }

    // Draw to single tile to create a grid
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

    // draw the top red cursor
    function drawCursor() {
        const posX = cursorX * tileSizeX;
        const posY = cursorY * tileSizeY;
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 10, 10, 0.8)';
        ctx.strokeRect(posX + 1, posY + 1, tileSizeX - 2, tileSizeY - 2);
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
                updateSpriteData(currentSprite);   // from sprite-editor.js
            }
            colors = placedSprites[tileKey].color; // color grab
            updateColor(colors); // from palette.js
            //toolbar(currentSprite, colors, currentLayer, mouse);
        }
    }

    // Function to hide a layer
    function hideLayer(layer) {
        hiddenLayers.add(layer);
    }

    // Function to show a layer
    function showLayer(layer) {
        hiddenLayers.delete(layer);
    }

    // Handle placing/removing sprites
    function handleTileClick(event) {
        //const rect = canvas.getBoundingClientRect();
        //const mouseX = event.clientX - rect.left;
        //const mouseY = event.clientY - rect.top;
        //const { x, y } = getTileCoordinates(mouseX, mouseY);

        const [x, y] = [mouse.x, mouse.y]
        const tileKey = `${currentLayer},${x},${y}`;
        [cursorX, cursorY] = [x, y];
        console.log(`mouse: cursor ${cursorX},${cursorY}`);
        switch (event.button) {
            case 2: // right mouse button
                grabSprite(tileKey);
                break;
            case 0: // left mouse button
                if (placedSprites[tileKey]) {
                    // Remove sprite if it exists
                    if (placedSprites[tileKey].type != 'player') delete placedSprites[tileKey];
                } else {
                    // Place sprite
                    placedSprites[tileKey] = {
                        sprite: currentSprite,    // add current selected sprite (number)
                        image: getSpriteImage(),   // add sprite data (2D array)
                        color: colors,            // add current colors from palette (array)
                        type: type
                    };
                    //console.log(placedSprites);
                }
                break;
            case 1:
                if (placedSprites[tileKey]) {
                    const color = [
                        adjustColor(placedSprites[tileKey].color[0], .1),
                        adjustColor(placedSprites[tileKey].color[1], .1)
                    ];
                    placedSprites[tileKey].color = color;

                }
        }
        drawBoard(); //<------------------------------------- Draw function for entire board
        //DrawSingleTile(); // <---------------------------------------------------- Draw Tile Function 1/2
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick);

    }

    // callback function for loading board POSSIBLY REMOVE
    function handleLoadedBoard(data) {
        console.log("Data loaded into application:", data);
        placedSprites = data;
        drawBoard(); //<------------------------------------- Draw function for entire board
    }

    // callback function for loading game. Loads single boards
    function handleLoadedGame(spriteSheetData, boardData) {
        placedSprites = boardData;
        replaceSpriteSheet(spriteSheetData);
        console.log('Loaded Board');
        drawBoard(); //<------------------------------------- Draw function for entire board
    }

    function handleToolbarClick(layer = currentLayer, hidden) {
        currentLayer = layer;
        hiddenLayers = hidden;
        console.log('current layer: ', currentLayer);
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick);
        drawBoard(); //<------------------------------------- Draw function for entire board
    }

    // Handles mouse clicks
    function handleClick(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        mouse.x = Math.floor(x / tileSizeX);
        mouse.y = Math.floor(y / tileSizeY);
        mouse.down = true;
        mouse.button = event.button;

        if (x <= tilesX * tileSizeX) { // possibly UPDATE
            handleTileClick(event);
            mouse.oldX = mouse.x;
            mouse.oldY = mouse.y;
        }
        else {
            // handle toolbar clicks from toolbar.js
            //toolbarClicked(x, y);
            colors = currentColors;
            console.log('toolbar clicked');
            
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
                mouse.oldX = x;
                mouse.oldY = y;
            }
        }
    }

    function handleKeyboard(event) {
        const tileKey = `${currentLayer},${cursorX},${cursorY}`;
        console.log(event.key);

        switch (event.key) {

            case 'ArrowUp':
                if (cursorY > 0) cursorY -= 1;          // Move up
                break;
            case 'ArrowDown':
                if (cursorY < tilesY - 1) cursorY += 1; // Move down
                break;
            case 'ArrowLeft':
                if (cursorX > 0) cursorX -= 1;          // Move left
                break;
            case 'ArrowRight':
                if (cursorX < tilesX - 1) cursorX += 1; // Move right
                break;
            case ' ':
                if (placedSprites[tileKey]) {

                    if (placedSprites[tileKey].type != 'player') delete placedSprites[tileKey]; // Remove sprite if it exists
                } else {
                    // Place sprite
                    placedSprites[tileKey] = {
                        sprite: currentSprite,    // add current selected sprite (number)
                        color: colors,            // add current colors from palette (array)
                        image: getSpriteImage(),  // add sprite image data
                        type: type                // default type is wall
                    };
                };
                //drawBoard(); // Refresh board
                //drawSprites();

                break;
            case 'Enter': // add layers later
                grabSprite(tileKey);
                if (event.repeat) { return }
                break;
            case 'PageUp':
                if (scale < 2) scale += 0.1;
                canvas.width = displayWidth * scale;
                canvas.height = displayHeight * scale;
                console.log('scale: ', scale);
                break;
            case 'PageDown':
                if (scale > 0.5) scale -= 0.1;
                canvas.width = displayWidth * scale;
                canvas.height = displayHeight * scale;
                console.log('scale: ', scale);
                break;
            case 'Insert':
                type = type === 'wall' ? 'coin' : 'wall';
                console.log('type: ', type);
                break;
        }

        switch (event.key.toLowerCase()) {
            case 'e':
                removeMainEvents();
                editSprite(currentSprite); // Open the sprite editor from sprite-editor.js
                if (event.repeat) { return }
                break;
            case 'c':
                removeMainEvents();
                pickColor(); // Open color picker from palette.js
                if (event.repeat) { return }
                break;
            case '=':
                if (currentSprite < tileSetLength) currentSprite += 1; // iterate through sprite sheet
                console.log('current sprite: ' + currentSprite);
                updateSpriteData(currentSprite);
                break;
            case '-':
                if (currentSprite > 1) currentSprite -= 1;
                console.log('current sprite: ' + currentSprite);
                updateSpriteData(currentSprite);
                break;
            case 'b':
                if (!event.ctrlKey) saveBoard(placedSprites); // save board (not sprite sheet)
                if (event.repeat) { return }
                break;
            case 'o':
                editObject(); // open object script editor from object-editor.js
                if (event.repeat) { return }
                break;
            case '1':
                currentLayer = 1; // change layer for placing sprites
                if (event.repeat) { return }
                break;
            case '2':
                currentLayer = 2;
                if (event.repeat) { return }
                break;
            case '3':
                currentLayer = 3;
                if (event.repeat) { return }
                break;
            case 'h': // for hiding or showing layers
                if (hiddenLayers.has(currentLayer)) {
                    showLayer(currentLayer);
                    console.log('showing layer: ', currentLayer);
                }
                else {
                    hideLayer(currentLayer);
                    console.log('hiding layer: ', currentLayer);
                }
                if (event.repeat) { return }
                drawBoard(); //<------------------------------------- Draw function for entire board
                return;
            case 's': // Save board & sprite sheet
                saveCombinedData(getSpriteSheet(), placedSprites);
                break;
            case 'l': // load board & sprite sheet
                loadCombinedData(handleLoadedGame);
                break;
            case 'r': // reset board
                if (confirm('Are you sure you want reset board?')) {
                    placedSprites = {};
                    console.log('Board reset');
                    drawBoard(); //<------------------------------------- Draw function for entire board
                } else {
                    console.log('Board not reset');
                }
                break;

        }

        if (event.ctrlKey || event.metaKey) {
            // Handle key combinations for both Windows/Linux (Ctrl) and Mac (Cmd)
            key.ctrl = true;
            switch (event.key.toLowerCase()) { // Check the key
                case "b": // Handle 'Ctrl + B' to load board (no sprite sheet)
                    loadBoard(handleLoadedBoard);
                    if (event.repeat) { return }
                    return;
            }
        }
        //console.log(`key: cursor ${cursorX},${cursorY}`);
        //drawBoard(); // Redraw the board and cursor
        DrawSingleTile(cursorX, cursorY); // <---------------------------------------------------- Draw Tile Function 2/2
        [mouse.oldX, mouse.oldY] = [cursorX, cursorY];
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick);
    }

    window.addMainEvents = function () {
        // Handle events for mouse
        canvas.addEventListener('mousedown', handleClick);
        canvas.addEventListener('mouseup', () => { mouse.down = false; });
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener('mouseleave', () => { mouse.down = false; });
        //canvas.addEventListener("mouseenter", () => { mouse.down = true; });

        // handles keypresses
        canvas.addEventListener('keydown', handleKeyboard);
        canvas.addEventListener('keyup', () => { Object.assign(key, { ctrl: false, shift: false, alt: false }); });
        colors = currentColors;
        drawBoard(); //<------------------------------------- Draw function for entire board
        canvas.focus();
    }

    window.removeMainEvents = function () {
        canvas.removeEventListener('mousedown', handleClick);
        canvas.removeEventListener('mouseup', () => { });
        canvas.removeEventListener("mousemove", handleMouseMove);

        canvas.removeEventListener('keydown', handleKeyboard);
        canvas.removeEventListener('keyup', () => { });
    }

    editorToolbar.onclick = () => {
        colors = currentColors;
        canvas.focus();
        console.log('toolbar clicked');
    }

    //document.getElementById('saveBoard').addEventListener('click', saveBoard(placedSprites));

    // Initial player setup
    placedSprites[`${player.layer},${player.x},${player.y}`] = {
        sprite: 1,
        image: getSpriteImage(),
        color: [[0, 0, 255, .5], [255, 255, 255, 1]],
        type: 'player',
        direction: 'down',
        layer: 2
    };

    // Initial canvas setup
    addMainEvents();
    toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick);
    drawBoard(); //<------------------------------------- Draw function for entire board
});