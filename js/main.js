import { toolbar, updateType } from './toolbar.js';
import { drawSprite, adjustColor, createDataURL, convertToImageData } from './sprite.js';
import { editSprite, updateSpriteData } from './sprite-editor.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { pickColor, currentColors, updateColor } from './palette.js';
import { saveBoard, loadBoard, saveCombinedData, loadCombinedData } from './file.js';
import { editObject, getObjectData } from './object-editor.js';

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
    let [cursorX, cursorY] = [9, 4];     // Keyboard cursor
    let currentSprite = 1;               // Sprite to draw. Default = 1
    let currentLayer = 2;                // Layer to draw sprite on. 1 = floor 2 = default 3 = ceiling
    let tileSetLength = 300;             // Size of tileset
    let colors = currentColors;          // colors selected from palette
    let type = 'wall';
    let tileData = { script: '' };                                                                      // default type for placed sprites
    let key = { ctrl: false, shift: false, alt: false, lastClick: 0, clickDelay: 100 };     // keyboard status object. click delay in ms
    let mouse = {
        x: cursorX, y: cursorY, oldX: cursorX, oldY: cursorY, down: false,
        button: 0, mode: 'draw', lastClick: 0, clickDelay: 50
    };                                                                                      // mouse status object. click delay. see handleMouseMove function. click delay in ms
    let player = { x: 20, y: 20, oldX: 20, oldY: 20, layer: 2 }                             // basic stats for player

    function getSpriteImage() {
        const data = getDataFromSheet(currentSprite); // from sprite-sheet.js
        return data;
    }

    function createPlayer() {
        placedSprites[`${player.layer},${player.x},${player.y}`] = {
            sprite: 1,
            image: getSpriteImage(),
            color: [[0, 0, 255, .5], [255, 255, 255, 1]],
            type: 'player',
            direction: 'down',
            layer: 2
        };
    }

    // DRAW EVERY TILE

    // Draw the grid of tiles
    function drawBoard() {
        ctx.clearRect(0, 0, tilesX * tileSizeX + 1, tilesY * tileSizeY); // +1 to get rid of the line next to toolbar

        drawSprites();
        drawCursor();
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

    // draw the top red cursor
    function drawCursor() {
        const posX = cursorX * tileSizeX;
        const posY = cursorY * tileSizeY;
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 10, 10, 0.8)';
        ctx.strokeRect(posX + 1, posY + 1, tileSizeX - 2, tileSizeY - 2);
    }

    // Helper Function for Color Similarity
    function isSimilarColor(color1, color2, tolerance = 0) {
        if (!color1 || !color2) return false; // Prevent errors if one is empty
        const [r1, g1, b1] = color1[0]; // Extract primary color (ignoring alpha)
        const [r2, g2, b2] = color2[0];

        return (
            Math.abs(r1 - r2) < tolerance &&
            Math.abs(g1 - g2) < tolerance &&
            Math.abs(b1 - b2) < tolerance
        );
    }

    // Flood fill algorithm
    function floodFill(startX, startY, newSpriteData, useColorComparison = true) {
        const startKey = `${currentLayer},${startX},${startY}`;
        const startTile = placedSprites[startKey] || null; // Get starting tile or null if empty

        // Store the starting color or sprite type
        const startColor = startTile ? startTile.color : null;
        const startSprite = startTile ? startTile.sprite : null;

        // Stack for iterative flood fill
        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${currentLayer},${x},${y}`;

            // **Boundary Check**: Ensure x and y are within valid board range
            if (x < 0 || y < 0 || x >= 36 || y >= 25) continue;
            
            // Avoid re-processing the same tile
            if (visited.has(key)) continue;
            visited.add(key);

            const currentTile = placedSprites[key] || null; // Get tile, or null if empty
            const currentColor = currentTile ? currentTile.color : null;
            const currentSprite = currentTile ? currentTile.sprite : null;

            if (currentTile && currentTile.type === 'player') continue; // Skip player

            // **Determine if the tile should be filled**
            let shouldFill = false;
            if (useColorComparison) {
                shouldFill = !currentTile || isSimilarColor(startColor, currentColor);
            } else {
                shouldFill = !currentTile || currentSprite === startSprite;
            }

            if (!shouldFill) continue; // Skip if the tile doesn't match the criteria

            // Fill the tile with the new sprite and color
            placedSprites[key] = {
                ...newSpriteData,
                type: newSpriteData.type || (currentTile ? currentTile.type : "wall") // Default to "wall" if empty
            };

            // Add neighboring tiles to the stack
            const neighbors = [
                [x + 1, y], // Right
                [x - 1, y], // Left
                [x, y + 1], // Down
                [x, y - 1], // Up
            ];
            for (const [nx, ny] of neighbors) {
                const neighborKey = `${currentLayer},${nx},${ny}`;
                if (!visited.has(neighborKey)) {
                    stack.push([nx, ny]);
                }
            }
        }
        // Redraw the board after flood fill
        drawBoard();
    }

    // grab the sprite at cursor when Enter key or right click
    function grabSprite(tileKey) {
        if (placedSprites[tileKey] !== undefined) {
            if (placedSprites[tileKey].type === 'sign') {
                /////////////////////////////////////////////////////
            }
            if (!key.ctrl) { // If the ctrl key isn't pressed then grab the sprite and color else just color
                currentSprite = placedSprites[tileKey].sprite;
                if (placedSprites[tileKey].type === 'player') {
                    type = 'wall';
                } else {
                    type = placedSprites[tileKey].type;
                }
                updateSpriteData(currentSprite);   // from sprite-editor.js
                updateType(type);                  // from toolbar.js
            }
            colors = placedSprites[tileKey].color; // color grab
            tileData = placedSprites[tileKey].data; // object data grab
            updateColor(colors); // from palette.js
        }
    }

    function placeSprite(key, sprite, type) {
        const tileKey = key;
        placedSprites[tileKey] = {
            sprite: sprite,
            image: getSpriteImage(),
            color: colors,
            type: type,
            layer: currentLayer,
            oldKey: tileKey,
            data: {
                name: '',
                speed: 2,
                timer: 0,
                script: '',
                scriptIndex: 0,
                text: '',
            } // default data for placed sprites
        };
        if (type === 'object' || type === 'sign') placedSprites[tileKey].data.script = tileData.script; // update object.data.script if type = sign or object
    }

    // Handle placing/removing sprites
    function handleTileClick(event) {
        const [x, y] = [mouse.x, mouse.y];
        const tileKey = `${currentLayer},${x},${y}`;
        [cursorX, cursorY] = [x, y];

        console.log(`mouse: cursor ${cursorX},${cursorY}`);

        switch (event.button) {
            case 2: // Right mouse button (Grab sprite)
                grabSprite(tileKey);
                break;
            case 0: // Left mouse button
                if (mouse.mode === 'draw') {
                    if (placedSprites[tileKey]) {
                        // Remove sprite if it exists (except player)
                        if (placedSprites[tileKey].type !== 'player') delete placedSprites[tileKey];
                    } else {
                        // Place sprite
                        placeSprite(tileKey, currentSprite, type); // Place sprite
                    }
                } else if (mouse.mode === 'fill') {
                    // Pressing SHIFT enables color-based filling
                    const useColorComparison = key.shift;

                    // Perform Flood Fill
                    floodFill(cursorX, cursorY, {
                        sprite: currentSprite,
                        image: getSpriteImage(),
                        color: colors,
                        type: type,
                        data: getObjectData()
                    }, useColorComparison);
                }
                break;
            case 1: // Middle mouse button (Adjust color)
                if (placedSprites[tileKey]) {
                    const color = [
                        adjustColor(placedSprites[tileKey].color[0], 0.1),
                        adjustColor(placedSprites[tileKey].color[1], 0.1)
                    ];
                    placedSprites[tileKey].color = color;
                }
        }

        drawBoard();
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
        hiddenLayers = new Set();
        console.log('Loaded Board');
        drawBoard(); //<------------------------------------- Draw function for entire board
    }

    function handleToolbarClick(layer = currentLayer, hidden = hiddenLayers, spriteType = type) {
        currentLayer = layer;
        hiddenLayers = hidden;
        type = spriteType;
        console.log('current layer: ', currentLayer);
        console.log('hidden layers: ', hiddenLayers);
        console.log('sprite type: ', type);
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

    function handleObjectScript(data, key) {
        placedSprites[key].data.script = data;
        //placedSprites[key].data.text = text;
        console.log('handle object script:', data);
    }

    function handleKeyboard(event) {
        const tileKey = `${currentLayer},${cursorX},${cursorY}`;
        //console.log(event.key);

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
                    placeSprite(tileKey, currentSprite, type); // Place sprite
                }
                break;
            case 'Enter': // add layers later
                grabSprite(tileKey);
                if (placedSprites[tileKey]) {
                    if (placedSprites[tileKey].type === 'sign') {
                        editObject('text', placedSprites[tileKey].data.script, tileKey, handleObjectScript); // open object script editor from object-editor.js
                        //placedSprites[tileKey].data.text = getObjectData(tileKey);
                    }
                    if (placedSprites[tileKey].type === 'object') {
                        editObject('object', placedSprites[tileKey].data.script, tileKey, handleObjectScript); // open object script editor from object-editor.js
                        //placedSprites[tileKey].data.script = getObjectData(tileKey);
                    }
                    console.log('grabbed:, ', placedSprites[tileKey]);
                }
                if (event.repeat) { return }
                break;
            case 'PageUp':
                console.log('type: ', type);
                if (event.repeat) { return }
                break;
            case 'Insert':
                // nothing here yet
                if (event.repeat) { return }
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
                updateSpriteData(currentSprite); // update sprite data from sprite-editor.js
                break;
            case '-':
                if (currentSprite > 1) currentSprite -= 1;
                console.log('current sprite: ' + currentSprite);
                updateSpriteData(currentSprite); // update sprite data from sprite-editor.js
                break;
            case 'b':
                if (!event.ctrlKey) saveBoard(placedSprites); // save board (not sprite sheet)
                if (event.repeat) { return }
                break;
            case 'i':
                placeSprite(tileKey, currentSprite, 'sign'); // Place sprite
                if (placedSprites[tileKey]) {
                    editObject('object', '', tileKey, handleObjectScript); // open object script editor from object-editor.js
                }
                if (event.repeat) { return }
                break;
            case 'o':
                placeSprite(tileKey, currentSprite, 'object'); // Place sprite
                if (placedSprites[tileKey]) {
                    editObject('object', '', tileKey, handleObjectScript); // open object script editor from object-editor.js
                }
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
                    //showLayer(currentLayer);
                    hiddenLayers.delete(currentLayer);
                    console.log('showing layer: ', currentLayer);
                }
                else {
                    //hideLayer(currentLayer);
                    hiddenLayers.add(currentLayer);
                    console.log('hiding layer: ', currentLayer);
                }
                if (event.repeat) { return }
                drawBoard(); //<------------------------------------- Draw function for entire board
                return;
            case 's': // Save board & sprite sheet
                saveCombinedData(getSpriteSheet(), placedSprites); // save board and sprite sheet from file.js and sprite-sheet.js
                break;
            case 'l': // load board & sprite sheet
                loadCombinedData(handleLoadedGame); // load board and sprite sheet from file.js
                break;
            case 'r': // reset board
                if (confirm('Are you sure you want reset board?')) {
                    placedSprites = {};
                    console.log('Board reset');
                    createPlayer();
                    drawBoard(); //<------------------------------------- Draw function for entire board
                } else {
                    console.log('Board not reset');
                }
                break;
            case 'f': // flood fill
                mouse.mode = 'fill';
                console.log('flood fill mode');
                break;
            case 'd':
                mouse.mode = 'draw';
                console.log('draw mode');
                break;
        }

        if (event.ctrlKey || event.metaKey) {
            // Handle key combinations for both Windows/Linux (Ctrl) and Mac (Cmd)
            key.ctrl = true;
            switch (event.key.toLowerCase()) { // Check the key
                case "b": // Handle 'Ctrl + B' to load board (no sprite sheet)
                    loadBoard(handleLoadedBoard); // from file.js
                    if (event.repeat) { return }
                    return;
            }
        }
        //console.log('main hidden:', hiddenLayers);
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
    }
    editorToolbar.onmouseup = () => {
        canvas.focus();
    }

    // Initial board setup
    createPlayer();
    addMainEvents();
    toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick);
    drawBoard(); //<------------------------------------- Draw function for entire board
});