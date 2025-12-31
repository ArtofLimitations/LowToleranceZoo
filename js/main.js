import { toolbar, updateType } from './toolbar.js';
import { drawSprite, createDataURL, adjustColor } from './sprite.js';
import { editSprite, updateSpriteData } from './sprite-editor.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { pickColor, currentColors, updateColor } from './palette.js';
import { saveCombinedData, loadCombinedData, saveWorld, loadWorld, loadSpriteSheetDialog } from './file.js';
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
    const overlay = document.getElementById('overlay');

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
    let type = 'wall';                   // type of sprite to place. wall, object, sign, passage, item, coin, ammo, invisible
    let currentAmount = 1;               // current value for item amount (ammo, coins, health, etc)
    let tileData = { script: '' };       // extra data for tile (script, amount, etc)
    let popup = { active: false, type: null };
    let boardList = [[1, 'Title Screen'], [2, 'Default']];
    let currentBoard = 2;                // current board ID
    let world = {};                      // default type for placed sprites
    let worldSaveData = {
        spritesheet: [],      // Will be filled when saving
        boards: [],           // Board list
        world: {},            // Board data

        // World-level settings and scripts
        worldSettings: {
            startingStats: {
                health: 100,
                ammo: 10,
                coins: 0,
                // ...add more as needed
            },
            deathBoard: 2,          // Board ID to go to on death
            globalScripts: "",      // Any global script text
            // ...future global settings
        },

        // Per-board settings and scripts
        boardSettings: {
            // Example for board 1
            1: {
                playerStart: { x: 10, y: 5, layer: 2 },
                reenterAtStart: true,
                linkedBoards: { east: 2, west: null, north: null, south: null },
                dark: false,
                nightmode: false,
                playerLocked: false,
                playerCanAttack: true,
                boardScript: "", // Board-specific script
                // ...future board settings
            },
            // Example for board 2
            2: {
                playerStart: { x: 20, y: 10, layer: 2 },
                reenterAtStart: false,
                linkedBoards: { east: null, west: 1, north: null, south: null },
                dark: true,
                nightmode: false,
                playerLocked: false,
                playerCanAttack: true,
                boardScript: "",
            }
            // ...add more boards as needed
        }
    };
    let key = { ctrl: false, shift: false, alt: false, lastClick: 0, clickDelay: 100 };   // keyboard status object. click delay in ms
    let mouse = {
        x: cursorX, y: cursorY, oldX: cursorX, oldY: cursorY, down: false,
        button: 0, mode: 'draw', lastClick: 0, clickDelay: 50
    };                                                                                    // mouse status object. click delay. see handleMouseMove function. click delay in ms
    let player = { x: 20, y: 20, oldX: 20, oldY: 20, layer: 2, oldLayer: 2 };             // basic stats for player

    // ######################################
    //          LOW TOLERANCE ZOO
    // ######################################

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

    function createPlayerInBoard(board) {
        world[board][`${player.layer},${player.x},${player.y}`] = {
            sprite: 1,
            image: getSpriteImage(),
            color: [[0, 0, 255, .5], [255, 255, 255, 1]],
            type: 'player',
            direction: 'down',
            layer: 2
        };
    }

    function findPlayerSprite() {
        // Find player sprite on current board
        for (const key in placedSprites) {
            if (placedSprites[key].type === 'player') {
                const [layer, x, y] = key.split(',').map(Number);
                player.x = x;
                player.y = y;
                player.layer = layer;
                player.oldX = x;
                player.oldY = y;
                break; // Exit loop after finding the player
            }
        }
    }

    function addBoardToWorld(newBoard = false) {
        if (newBoard) world[currentBoard] = placedSprites; // Add the current board to the world object
        else world[currentBoard] = {}; // Initialize the current board in the world object
        console.log('World:', world);
    }

    function createWorldFromBoards() {
        world = {}; // Initialize the world object
        for (const [boardId, boardName] of boardList) {
            world[boardId] = {}; // Create an empty object for each board
        }
        console.log('World:', world);
    }

    // ######################################
    // DRAWING FUNCTIONS
    // ######################################

    function getSpriteImage() {
        const data = getDataFromSheet(currentSprite); // from sprite-sheet.js
        return data;
    }

    function rgba(colorArray) {
        return `rgba(${colorArray[0]}, ${colorArray[1]}, ${colorArray[2]}, ${colorArray[3]})`;
    }

    // DRAW EVERY TILE
    function drawBoard() {
        ctx.clearRect(0, 0, tilesX * tileSizeX + 1, tilesY * tileSizeY); // +1 to get rid of the line next to toolbar

        drawSpritesAt();
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
                //drawSprite(x, y, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color); // draw sprite from sprite.js with array data
                if (spriteInfo) {
                    if (spriteInfo.type === 'passage') {
                        ctx.save()
                        ctx.globalAlpha = 0.5
                        ctx.fillStyle = rgba(colors[0]); // Set color for the passage
                        ctx.fillRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY); // Draw the passage area
                        ctx.fillStyle = rgba(colors[1]); // Set color for the passage
                        ctx.fillRect(x * tileSizeX + tileSizeX / 4, y * tileSizeY + tileSizeX / 4, tileSizeX / 2, tileSizeY / 2); // Draw the passage area

                        ctx.font = `${tileSizeY / 2}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = 'white'; // Text color
                        ctx.fillText('P', x * tileSizeX + tileSizeX / 2, y * tileSizeY + tileSizeY / 2);
                        ctx.restore();
                    } else {
                        drawSprite(x, y, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
                    }
                }
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
                switch (spriteInfo.type) {
                    case 'passage':
                        ctx.save()
                        ctx.globalAlpha = 0.5
                        ctx.fillStyle = rgba(spriteInfo.color[0]); // Set color for the passage
                        ctx.fillRect(sx * tileSizeX, sy * tileSizeY, tileSizeX, tileSizeY); // Draw the passage area
                        ctx.fillStyle = rgba(spriteInfo.color[1]); // Set color for the passage
                        ctx.fillRect(sx * tileSizeX + tileSizeX / 4, sy * tileSizeY + tileSizeX / 4, tileSizeX / 2, tileSizeX / 2); // Draw the passage area

                        //ctx.font = `${tileSizeY / 2}px Arial`;
                        ctx.font = `${tileSizeY}px Material Symbols Outlined`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = 'white'; // Text color
                        ctx.fillText('tools_ladder', sx * tileSizeX + tileSizeX / 2, sy * tileSizeY + tileSizeY / 2);
                        ctx.restore();
                        break;
                    case 'invisible':
                        ctx.save()
                        ctx.globalAlpha = 0.7;
                        ctx.globalCompositeOperation = 'exclusion'; // Set composite mode to source-over
                        ctx.fillStyle = 'rgb(255, 0, 55)'; // Set color of invisible tile
                        ctx.fillRect(sx * tileSizeX, sy * tileSizeY, tileSizeX, tileSizeY);

                        ctx.font = `${tileSizeY}px Material Symbols Outlined`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = 'white'; // Text color
                        ctx.fillText('texture', sx * tileSizeX + tileSizeX / 2, sy * tileSizeY + tileSizeY / 2);
                        ctx.restore();
                        break;
                    default:
                        drawSprite(sx, sy, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color);
                }
            }
        }
    }

    // DRAW SINGLE TILE
    function DrawSingleTile(x, y) {
        ctx.clearRect(mouse.oldX * tileSizeX, mouse.oldY * tileSizeY, tileSizeX, tileSizeY);
        ctx.clearRect(x * tileSizeX, y * tileSizeY, tileSizeX, tileSizeY);
        drawSpritesAt(mouse.oldX, mouse.oldY);
        drawSpritesAt(x, y);
        drawCursor();
    }

    // draw the top red cursor
    function drawCursor() {
        const posX = cursorX * tileSizeX;
        const posY = cursorY * tileSizeY;
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 10, 10, 0.8)';
        ctx.strokeRect(posX + 1, posY + 1, tileSizeX - 2, tileSizeY - 2);
    }

    // ######################################
    // PLACE SPRITE FUNCTIONS
    // ######################################

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
            //image: getSpriteImage(),
            color: colors,
            type: type,
            layer: currentLayer,
            oldKey: tileKey,
            data: {},
        }
        if (type === 'object' || type === 'sign') {
            placedSprites[tileKey].data = {
                name: '',
                speed: 2,
                timer: 0,
                script: '',
                scriptIndex: 0,
                text: '',
            }; // default data for placed sprites
        }
        if (type === 'passage') {
            placedSprites[tileKey].data = {
                speed: 1,
                board: currentBoard,
            };
        }
        if (type === 'item' || type === 'coin' || type === 'ammo') {
            placedSprites[tileKey].data = {
                value: currentAmount,
            };
        }
        if (type === 'object' || type === 'sign') placedSprites[tileKey].data.script = tileData.script; // update object.data.script if type = sign or object
    }

    // ######################################
    // EVENT HANDLING FUNCTIONS
    // ######################################

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
                        //image: getSpriteImage(),
                        color: colors,
                        type: type,
                        data: getObjectData()
                    }, useColorComparison);

                    mouse.mode = 'draw'; // Reset mode after filling
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
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
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

        if (popup.active === false) { // possibly UPDATE
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
                    now - mouse.lastClick > mouse.clickDelay &&
                    popup.active === false) {
                    handleTileClick(event);
                    mouse.lastClick = now; // Update the last click time
                }
                mouse.oldX = x;
                mouse.oldY = y;
            }
        }
    }

    // callback function for loading game. Loads single boards
    function handleLoadedBoard(spriteSheetData, boardData) {
        placedSprites = boardData;
        addBoardToWorld(true); // Add the current board to the world object
        replaceSpriteSheet(spriteSheetData);

        findPlayerSprite(); // Find the player sprite on the current board

        hiddenLayers = new Set();

        console.log('Loaded Board');
        drawBoard();

        updateSpriteData(currentSprite);
    }

    function handleLoadedWorld(spriteSheetData, boardListData, worldData) {
        boardList = boardListData; // Load the board list
        world = worldData; // Load the world data  
        replaceSpriteSheet(spriteSheetData); // Load the sprite sheet data

        hiddenLayers = new Set();
        currentBoard = 1; // Set the current board to the first one
        placedSprites = world[currentBoard]; // Get the current board from the world object

        findPlayerSprite(); // Find the player sprite on the current board

        console.log('Loaded World');
        drawBoard();

        updateSpriteData(currentSprite);
    }

    function handleToolbarClick(options = {}) {
        if (options.layer !== undefined) currentLayer = options.layer;
        if (options.hidden !== undefined) hiddenLayers = options.hidden;
        if (options.type !== undefined) type = options.type;
        if (options.current !== undefined) {
            currentSprite = options.current;
            updateSpriteData(currentSprite);
        }

        console.log('current layer: ', currentLayer);
        console.log('hidden layers: ', hiddenLayers);
        console.log('sprite type: ', type);

        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
        drawBoard();
    };

    /*function handleToolbarClick(layer = currentLayer, hidden = hiddenLayers, spriteType = type) {
        currentLayer = layer;
        hiddenLayers = hidden;
        type = spriteType;
 
        console.log('current layer: ', currentLayer);
        console.log('hidden layers: ', hiddenLayers);
        console.log('sprite type: ', type);
 
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick);
        drawBoard();
    }*/

    function handleObjectScript(data, key) {
        placedSprites[key].data.script = data;

        console.log('handle object script:', data);
    }

    // ######################################
    // POPUP FUNCTIONS 
    // ######################################

    function spriteSelect() { // Select from a list of sprites
        popup.active = true;
        popup.type = 'spriteSelect';

        overlay.style.display = 'block';

        const spriteContainer = document.getElementById('selectSpriteBox');

        spriteContainer.style.display = 'flex';

        createSpriteGallery(getSpriteSheet(), (index) => {
            currentSprite = index; // Update the current sprite
            console.log('Selected sprite:', index);
            updateSpriteData(currentSprite); // Update the sprite data in the toolbar
            popup.active = false; // Close the popup
            overlay.style.display = 'none'; // Hide the overlay
            spriteContainer.style.display = 'none'; // Hide the popup container
            canvas.focus(); // Focus back on the canvas
        });
        // Append or update sprite sheet length in spriteContainer
        let spriteSheetLength = spriteContainer.querySelector('.spriteSheetLength');
        if (!spriteSheetLength) {
            // If the element doesn't exist, create it
            spriteSheetLength = document.createElement('div');
            spriteSheetLength.classList.add('spriteSheetLength');
            spriteContainer.appendChild(spriteSheetLength);
        }

        // Update the text content of the element
        spriteSheetLength.textContent = `(${getSpriteSheet().length}/300)`;

        document.addEventListener('keydown', (event) => {
            if (popup.active && popup.type === 'spriteSelect' && event.key === 'Enter' || event.key === 'Escape') {
                popup.active = false; // Close the popup
                overlay.style.display = 'none'; // Hide the overlay
                spriteContainer.style.display = 'none'; // Hide the popup container
                canvas.focus(); // Focus back on the canvas
            }
        });
    }

    function createSpriteGallery(spriteSheet, onSpriteClick) {
        console.log('Creating sprite gallery...', spriteSheet);
        const gallery = document.getElementById('spriteGallery');
        gallery.innerHTML = ''; // Clear any existing content

        for (let index = 1; index <= spriteSheet.length; index++) {
            if (index === 0) return; // Skip the first sprite (empty sprite)
            const spriteElement = document.createElement('div');
            spriteElement.classList.add('sprite-item');
            spriteElement.style.width = `${tileSizeX}px`;
            spriteElement.style.height = `${tileSizeY}px`;
            spriteElement.style.backgroundImage = createDataURL(getDataFromSheet(index), colors[0], colors[1]).then((img) => {
                spriteElement.appendChild(img); // Append the image to the sprite element
            });
            spriteElement.style.backgroundSize = 'contain';
            spriteElement.style.cursor = 'pointer';

            // Add a click event to change the current sprite
            spriteElement.onclick = () => {
                currentSprite = index;
                onSpriteClick(index); // Callback for additional actions
                console.log(`Selected sprite: ${index}`);
            };

            gallery.appendChild(spriteElement);
        };
    }

    function boardSelect(onlySelect = false, key = `${currentLayer},${mouse.x},${mouse.y}`, selected) { //  Board selector. This is a popup that allows the user to select a board from the list of boards.
        popup.active = true;
        popup.type = 'boardSelect';

        overlay.style.display = 'block';

        const addButton = document.getElementById('addBoardButton');
        const selectContainer = document.getElementById('boardSelect');
        const listItems = document.getElementById('boardListItems');
        let boardSelected = ''; // Variable to store the selected board

        listItems.innerHTML = ''; // Clear previous items

        boardList.forEach((item) => {
            const listItem = document.createElement('li');
            listItem.textContent = item[1]; // Display the name of the board
            if (item[0] === currentBoard) {
                listItem.classList.add('selected'); // Highlight the selected board
            }
            if (item[0] === selected) { // append <strong> Selected </strong> to the selected board
                listItem.innerHTML = `${item[1]} <span class="selectedBoard">Selected</span>`;
            }

            listItem.onclick = () => {
                if (!onlySelect) {
                    currentBoard = item[0]; // Set the selected board
                    console.log('Selected Board: ', currentBoard);
                    placedSprites = world[currentBoard]; // Get the selected board from the world object
                    findPlayerSprite(); // Find the player sprite on the selected board
                    drawBoard();
                }
                boardSelected = item[0]; // Store the selected board ID

                popup.active = false;
                overlay.style.display = 'none';
                selectContainer.style.display = 'none';
                canvas.focus();

                if (onlySelect) placedSprites[key].data.board = boardSelected; // Set the board ID for the passage
                console.log('Selected Board ID: ', boardSelected); // Log the selected board ID
                //if (onlySelect) return boardSelected; // Return the selected board ID if only selecting
            };
            listItems.appendChild(listItem);
        });
        addButton.onclick = () => { // Add new board button
            const newBoardName = prompt('Enter new board name:');
            if (newBoardName) {
                const newBoardId = boardList.length + 1; // Simple ID generation
                boardList.push([newBoardId, newBoardName]);
                world[newBoardId] = {}; // Initialize the new board in the world object
                createPlayerInBoard(newBoardId); // Create player in the new board
                console.log('New Board Added: ', newBoardId, newBoardName);

                boardSelect(); // Refresh the board selector to show the new board
            }
        }
        selectContainer.style.display = 'block';
    }

    function selectAmount(string, current = 0, tileKey) { // popup to select a number for an item tile and return it
        popup.active = true;
        popup.type = 'selectAmount';

        overlay.style.display = 'block';

        const selectContainer = document.getElementById('selectAmount');
        const inputField = document.createElement('input'); // Create a new input field
        const confirmButton = document.createElement('button'); // Create a new button

        selectContainer.style.display = 'flex';
        selectContainer.innerHTML = `<strong>${string}</strong>`; // Set the title of the popup
        selectContainer.appendChild(inputField); // Append the input field to the popup
        selectContainer.appendChild(confirmButton); // Append the button to the popup
        selectContainer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === 'Escape') { // If Enter key is pressed
                const amount = parseInt(inputField.value, 10); // Get the value from the input field
                if (!isNaN(amount)) {
                    currentAmount = amount; // Set the current amount to the input value
                    placedSprites[tileKey].data.value = currentAmount; // Set the amount in the placed sprite data
                    popup.active = false; // Close the popup
                    overlay.style.display = 'none'; // Hide the overlay
                    selectContainer.style.display = 'none'; // Hide the popup container
                    canvas.focus(); // Focus back on the canvas
                }
            }
        });

        inputField.type = 'number'; // Set the type to number
        inputField.value = current; // Set the current amount in the input field
        inputField.classList.add('inputField'); // Add a class for styling
        inputField.focus(); // Focus on the input field

        confirmButton.textContent = 'Confirm'; // Set button text
        confirmButton.classList.add('inputField'); // Add a class for styling
        confirmButton.onclick = () => {
            const amount = parseInt(inputField.value, 10); // Get the value from the input field
            if (!isNaN(amount)) {
                currentAmount = amount; // Set the current amount to the input value
                placedSprites[tileKey].data.value = currentAmount; // Set the amount in the placed sprite data
                popup.active = false; // Close the popup
                overlay.style.display = 'none'; // Hide the overlay
                selectContainer.style.display = 'none'; // Hide the popup container
                canvas.focus(); // Focus back on the canvas
            } else {
                alert('Please enter a valid number!'); // Alert if not a number
            }
        };
    }

    function selectPushType(current = 'ANY', tileKey) {
        popup.active = true;
        popup.type = 'selectPushType';

        overlay.style.display = 'block';

        const selectContainer = document.getElementById('selectAmount');
        selectContainer.style.display = 'flex';
        selectContainer.innerHTML = `<strong>Select Push Tile Type:</strong>`;

        const options = ['EW', 'NS', 'ANY'];
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.textContent = option;
            btn.className = 'inputField';
            if (option === current) btn.style.fontWeight = 'bold';
            btn.onclick = () => {
                placedSprites[tileKey].data.pushType = option;
                popup.active = false;
                overlay.style.display = 'none';
                selectContainer.style.display = 'none';
                canvas.focus();
            };
            selectContainer.appendChild(btn);
        });

        // Allow Escape to close
        selectContainer.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                popup.active = false;
                overlay.style.display = 'none';
                selectContainer.style.display = 'none';
                canvas.focus();
            }
        });

        selectContainer.tabIndex = 0;
        selectContainer.focus();
    }

    const popupHandlers = {
        extraItems: {
            p: (tileKey) => {
                type = 'passage'; // Set type to passage
                placeSprite(tileKey, currentSprite, 'passage'); // Place sprite
                closePopup();
            },
            c: (tileKey) => {
                type = 'coin'; // Set type to coin
                placeSprite(tileKey, currentSprite, 'coin'); // Place sprite
                closePopup();
            },
            a: (tileKey) => {
                type = 'ammo'; // Set type to ammo
                placeSprite(tileKey, currentSprite, 'ammo'); // Place sprite
                closePopup();
            },
            i: (tileKey) => {
                placeSprite(tileKey, currentSprite, 'sign'); // Place sprite
                if (placedSprites[tileKey]) editObject('object', '', tileKey, handleObjectScript); // open object script editor from object-editor.js
                closePopup();
            }
        },
        extraTerrain: {
            w: (tileKey) => {
                type = 'wall'; // Set type to wall
                placeSprite(tileKey, currentSprite, 'wall'); // Place sprite
                closePopup();
            },
            s: (tileKey) => {
                type = 'step'; // Set type to step tile
                placeSprite(tileKey, currentSprite, 'step'); // Place sprite
                closePopup();
            },
            b: (tileKey) => {
                type = 'break'; // Set type to break tile
                placeSprite(tileKey, currentSprite, 'break'); // Place sprite
                closePopup();
            },
            p: (tileKey) => {
                type = 'push'; // Set type to push tile
                placeSprite(tileKey, currentSprite, 'push'); // Place sprite    
                closePopup();
            },
            i: (tileKey) => {
                type = 'invisible'; // Set type to invisible tile
                placeSprite(tileKey, currentSprite, 'invisible'); // Place sprite
                closePopup();
            }
        },
        extraCreatures: {
            // Add key handlers for extraCreatures here
        },
    };

    function closePopup() {
        if (!popup.type) return; // If no popup type is active, do nothing

        // Hide the currently active popup
        const activePopup = document.getElementById(popup.type);
        if (activePopup) {
            activePopup.style.display = 'none';
        }

        // Reset popup state
        popup.active = false;
        popup.type = null;

        // Hide the overlay
        overlay.style.display = 'none';

        // Refocus the canvas
        canvas.focus();
    }

    // ######################################
    // KEYBOARD HANDLING FUNCTIONS
    // ######################################

    // Key mapping (now using key names instead of key codes)
    let util = { Tab: "tab", Enter: "enter", Shift: "shift", Alt: "alt", Escape: "esc", PageUp: "rePag", PageDown: "avPag", End: "end", Home: "home", ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6", F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12" };
    let enterPressed = false; // Lock variable

    function handleKeyboard(event) {
        const tileKey = `${currentLayer},${cursorX},${cursorY}`;
        //console.log(event.key);

        var keycode = event.code; // Use event.code
        if (util[keycode]) {
            event.preventDefault();
        }

        if (!popup.active) { // use different key events for popups like the board selector

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
                case 'Enter': // to grab sprite or modify tile
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
                        if (placedSprites[tileKey].type === 'passage') { // need to set passage ID
                            boardSelect(true, tileKey, placedSprites[tileKey].data.board); // open board selector for selecting board ID Only (true)
                            console.log('passage board: ', placedSprites[tileKey].data.board);
                        }
                        if (placedSprites[tileKey].type === 'coin' || placedSprites[tileKey].type === 'ammo') {

                            if (!placedSprites[tileKey].data) {
                                placedSprites[tileKey].data = {}; // Initialize the data object if it doesn't exist
                            }
                            placedSprites[tileKey].data.value = placedSprites[tileKey].data.value || 1; // Set default amount if not set

                            selectAmount('Enter quantity:', placedSprites[tileKey].data.value, tileKey); // open item selector for selecting amount of items
                            console.log('item amount: ', placedSprites[tileKey].data.value);
                        }
                        if (placedSprites[tileKey].type === 'push') {
                            selectPushType(placedSprites[tileKey].data.pushType || 'ANY', tileKey); // open push type selector for selecting push type
                            console.log('push type: ', placedSprites[tileKey].data.pushType);
                        }
                        console.log('grabbed:, ', placedSprites[tileKey]);
                        enterPressed = true; // Lock it
                    }
                    if (event.repeat) { return }
                    break;
                case 'Tab': // Paint Mode
                    if (mouse.mode === 'paint') mouse.mode = 'draw';
                    else mouse.mode = 'paint';
                    console.log('paint mode');
                case 'PageUp':
                    console.log('type: ', type);
                    if (event.repeat) { return }
                    break;
                case 'Insert':
                    // nothing here yet
                    console.log('placed sprites: ', placedSprites);
                    if (event.repeat) { return }
                    break;
                case 'Delete': // delete all sprites in current layer
                    if (confirm('Are you sure you want to delete all sprites in this layer?')) {
                        for (let key in placedSprites) {
                            const [layer] = key.split(',').map(Number); // Extract layer from key
                            if (layer === currentLayer) {
                                delete placedSprites[key];
                            }
                        }
                        console.log('Deleted all sprites in layer:', currentLayer);
                        drawBoard();
                    }
                    break;
                case 'F1': //save world
                    saveWorld(getSpriteSheet(), boardList, world); // save world from file.js
                    if (event.repeat) { return }
                    break;
                case 'F3': //load world
                    loadWorld(handleLoadedWorld); // load world from file.js
                    if (event.repeat) { return }
                    break;
                case 'F9': // extra terrain tiles
                    popup.active = true;
                    popup.type = 'extraTerrain';
                    overlay.style.display = 'block';
                    document.getElementById('extraTerrain').style.display = 'flex';
                    if (event.repeat) { return }
                    break;
                case 'F10': // extra item tiles
                    popup.active = true;
                    popup.type = 'extraItems';
                    overlay.style.display = 'block';
                    document.getElementById('extraItems').style.display = 'flex';
                    if (event.repeat) { return }
                    break;
            }

            switch (event.key.toLowerCase()) {
                case 'e':
                    removeMainEvents();
                    editSprite(currentSprite, (newIndex) => {
                        // callback from sprite editor when it changes or closes
                        currentSprite = newIndex;
                        updateSpriteData(currentSprite);
                        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
                        drawBoard();
                        canvas.focus();
                    });
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
                case '+':
                    loadSpriteSheetDialog((spriteSheet) => {
                        replaceSpriteSheet(spriteSheet); // Update the in-memory spritesheet
                        drawBoard(); // Redraw to reflect new sprites
                        console.log('Spritesheet loaded!');
                    });
                    break;
                case 'v':
                    // open the sprite sheet selector here
                    spriteSelect(); // Open sprite sheet selector from sprite-sheet.js
                    if (event.repeat) { return }
                    break;
                case 'b':
                    // open the board selector here
                    boardSelect();
                    break;
                case '.':
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
                    drawBoard();
                    return;
                case 's': // Save board & sprite sheet
                    saveCombinedData(getSpriteSheet(), placedSprites); // save board and sprite sheet from file.js and sprite-sheet.js
                    break;
                case 'l': // load board & sprite sheet
                    loadCombinedData(handleLoadedBoard); // load board and sprite sheet from file.js
                    break;
                case 'r': // reset board
                    if (confirm('Are you sure you want reset board?')) {
                        placedSprites = {}; // Clear the current board
                        world[currentBoard] = placedSprites; // Update the world object with the reset board
                        console.log('Board reset');
                        createPlayer(); // Recreate the player sprite
                        drawBoard(); // Redraw the board
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
                case 'z':
                    // move player sprite to new location
                    if (currentBoard !== 1) { // no player on title screen
                        const playerKey = `${player.layer},${player.x},${player.y}`;
                        placedSprites[`${currentLayer},${cursorX},${cursorY}`] = {
                            sprite: 1,
                            image: getSpriteImage(),
                            color: [[0, 0, 255, .5], [255, 255, 255, 1]],
                            type: 'player',
                            direction: 'down',
                            layer: currentLayer,
                        };
                        [player.oldLayer, player.oldX, player.oldY] = [player.layer, player.x, player.y]; // save old location
                        [player.layer, player.x, player.y] = [currentLayer, cursorX, cursorY]; // move player to new location
                        delete placedSprites[playerKey]; // remove player sprite from old location
                        DrawSingleTile(player.oldX, player.oldY);
                    }
                    break;
            }

            if (event.ctrlKey || event.metaKey) {
                // Handle key combinations for both Windows/Linux (Ctrl) and Mac (Cmd)
                key.ctrl = true;
                switch (event.key.toLowerCase()) { // Check the key
                    case 'b': // Handle 'Ctrl + B' to load board (no sprite sheet)
                        loadBoard(handleLoadedBoard); // from file.js
                        if (event.repeat) { return }
                        return;
                    case 'n':
                        if (!event.ctrlKey) saveBoard(placedSprites); // save board (not sprite sheet)
                        if (event.repeat) { return }
                        break;
                }
            }
        } // end of popup check

        if (popup.active) {
            switch (event.key) {
                case 'Escape':
                case 'Enter':
                    if (enterPressed) break;
                    switch (popup.type) {
                        case 'extraTerrain':
                            document.getElementById('extraTerrain').style.display = 'none';
                            popup.active = false;
                            break;
                        case 'extraItems':
                            document.getElementById('extraItems').style.display = 'none';
                            popup.active = false;
                            break;
                        case 'boardSelect':
                            document.getElementById('boardSelect').style.display = 'none';
                            popup.active = false;
                            break;
                    }
                    overlay.style.display = 'none';
                    canvas.focus();
                    break;
            }
            //if (popup.active) {
            const handlers = popupHandlers[popup.type];
            if (handlers && handlers[event.key.toLowerCase()]) {
                handlers[event.key.toLowerCase()](tileKey); // Call the appropriate handler
                if (event.repeat) return;
            }
            //}
        }

        /*if (mouse.mode === 'paint') {
            if (placedSprites[tileKey] && placedSprites[tileKey].type === 'player');
            else placeSprite(tileKey, currentSprite, type); // Place sprite
        }*/

        if (mouse.mode === 'paint') {
            const tileKey = `${currentLayer},${cursorX},${cursorY}`;

            // Skip placing the player sprite
            if (!(placedSprites[tileKey] && placedSprites[tileKey].type === 'player')) {
                placeSprite(tileKey, currentSprite, type); // Place the sprite
            }
        }

        DrawSingleTile(cursorX, cursorY); // Draw the tile at the cursor position
        [mouse.oldX, mouse.oldY] = [cursorX, cursorY];
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
    }

    // ######################################
    // EVENT LISTENERS
    // ######################################

    window.addMainEvents = function () {
        // Handle events for mouse
        canvas.addEventListener('mousedown', handleClick);
        canvas.addEventListener('mouseup', () => { mouse.down = false; });
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', () => { mouse.down = false; });
        //canvas.addEventListener("mouseenter", () => { mouse.down = true; });

        // handles keypress
        canvas.addEventListener('keydown', handleKeyboard);
        canvas.addEventListener('keyup', (event) => {
            Object.assign(key, { ctrl: false, shift: false, alt: false });

            if (event.key === 'Enter') {
                enterPressed = false; // Unlock when Enter is released
            }
        });
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type); // Initialize toolbar with current sprite and colors
        colors = currentColors;
        drawBoard(); // Draw function for entire board
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

    overlay.addEventListener('mousedown', function (event) {
        if (popup.active) {
            // Optionally check if event.target === overlay to only close when clicking the background
            closePopup();
        }
    });

    // Initial board setup
    addMainEvents();
    createWorldFromBoards(); // Create the world object from the board list
    createPlayer();
    addBoardToWorld(); // Add the current board to the world object
    world[currentBoard] = placedSprites; // Initialize the current board in the world object
    toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
    drawBoard();
});