import { toolbar, updateType, updateLayers } from './toolbar.js';
import { drawSprite, createDataURL, adjustColor } from './sprite.js';
import { editSprite, updateSpriteData } from './sprite-editor.js';
import { getDataFromSheet, getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { pickColor, currentColors, updateColor, toolbarSwapColor } from './palette.js';
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
    ctx.imageSmoothingEnabled = false;

    const editorToolbar = document.getElementById('lowToleranceToolbar');
    const overlay = document.getElementById('overlay');

    // Low Tolerance Zoo editor Configurations
    const tileSizeX = 32;                // Single tile size
    const tileSizeY = 32;
    let hiddenLayers = new Set();        // Set to hold hidden layers
    let placedSprites = {};              // Store the positions of placed sprites (as key-value pairs)
    const boardHistories = {};
    const historyLimit = 200;
    let suppressHistory = false;
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
    let colorIntensity = 10;             // lighten/darken intensity (1-50)
    let intensityTooltip = { visible: false, timeout: null }; // tooltip for intensity changes
    let boardList = [[1, 'Title Screen'], [2, 'Default']];
    let currentBoard = 2;                // current board ID
    let world = {};                      // default type for placed sprites
    let worldSaveData = {
        spritesheet: [],      // Will be filled when saving
        boards: [],           // Board list
        world: {},            // Board data

        // World-level settings and scripts
        worldSettings: {
            playerStyles: {
                sprite: 1,
                color: [[0, 0, 255, .5], [255, 255, 255, 1]]
            },
            startingStats: {
                health: 100,
                ammo: 10,
                coins: 0,
                // ...add more as needed
            },
            switchBoardOnDeath: false,   // Whether to switch boards on player death
            deathBoard: 1,               // Board ID to go to on death
            globalScripts: "",           // Any global script text
            // ...future global settings
        },

        // Per-board settings and scripts (dynamically populated)
        boardSettings: {}
    };

    // Helper function to create default board settings
    function createDefaultBoardSettings(boardId, options = {}) {
        return {
            playerStart: options.playerStart || { x: 10, y: 5, layer: 2 },
            reenterWhenHurt: options.reenterWhenHurt !== undefined ? options.reenterWhenHurt : false,
            linkedBoards: options.linkedBoards || { east: null, west: null, north: null, south: null },
            dark: options.dark || false,
            nightmode: options.nightmode || false,
            layer1Opacity: options.layer1Opacity !== undefined ? options.layer1Opacity : 1.0,
            layer2Opacity: options.layer2Opacity !== undefined ? options.layer2Opacity : 1.0,
            layer3Opacity: options.layer3Opacity !== undefined ? options.layer3Opacity : 1.0,
            bulletLimit: options.bulletLimit !== undefined ? options.bulletLimit : 256,
            playerLocked: options.playerLocked || false,
            playerCanAttack: options.playerCanAttack !== undefined ? options.playerCanAttack : true,
            boardName: options.boardName || `Board ${boardId}`,
            boardScript: options.boardScript || "",
            // ...future board settings can be added here
        };
    }

    // Initialize board settings for a specific board
    function initializeBoardSettings(boardId, options = {}) {
        const defaults = createDefaultBoardSettings(boardId, options);
        const existing = worldSaveData.boardSettings[boardId];

        if (!existing) {
            worldSaveData.boardSettings[boardId] = defaults;
        } else {
            worldSaveData.boardSettings[boardId] = {
                ...defaults,
                ...existing
            };

            if (options.boardName) {
                worldSaveData.boardSettings[boardId].boardName = options.boardName;
            }
        }

        return worldSaveData.boardSettings[boardId];
    }

    function getCurrentBoardSettings() {
        return initializeBoardSettings(currentBoard);
    }

    function getLayerOpacity(layer) {
        const settings = getCurrentBoardSettings();
        const key = `layer${layer}Opacity`;
        const value = settings?.[key];
        if (typeof value !== 'number') return 1;
        return Math.max(0, Math.min(1, value));
    }

    let key = { ctrl: false, shift: false, alt: false, lastClick: 0, clickDelay: 100 };   // keyboard status object. click delay in ms
    let mouse = {
        x: cursorX, y: cursorY, oldX: cursorX, oldY: cursorY, down: false,
        button: 0, mode: 'draw', lastClick: 0, clickDelay: 50
    };                                                                                    // mouse status object. click delay. see handleMouseMove function. click delay in ms
    let player = { x: 20, y: 20, oldX: 20, oldY: 20, layer: 2, oldLayer: 2 };             // basic stats for player
    let statusMessageTimeout = null; // timer for temporary canvas messages

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
            resetBoardHistory(boardId);
            // Initialize board settings with board name
            initializeBoardSettings(boardId, { boardName: boardName });
        }
        console.log('World:', world);
        console.log('Board Settings:', worldSaveData.boardSettings);
    }

    // ######################################
    // DRAWING FUNCTIONS
    // ######################################

    function showIntensityTooltip() {
        intensityTooltip.visible = true;
        if (intensityTooltip.timeout) clearTimeout(intensityTooltip.timeout);
        intensityTooltip.timeout = setTimeout(() => {
            intensityTooltip.visible = false;
            drawBoard();
        }, 800); // Fade after 0.8 seconds
        drawBoard();
    }

    function getSpriteImage() {
        const data = getDataFromSheet(currentSprite); // from sprite-sheet.js
        return data;
    }

    function rgba(colorArray) {
        return `rgba(${colorArray[0]}, ${colorArray[1]}, ${colorArray[2]}, ${colorArray[3]})`;
    }

    // Show a temporary message near the bottom of the canvas
    function showStatusMessage(message, duration = 2000) {
        if (!message) return;
        const container = document.getElementById('block') || document.body;
        let el = document.getElementById('canvasMessage');

        if (!el) {
            el = document.createElement('div');
            el.id = 'canvasMessage';
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.bottom = '24px';
            el.style.transform = 'translateX(-50%)';
            el.style.padding = '10px 20px';
            el.style.borderRadius = '10px';
            el.style.background = 'rgba(0, 0, 0, 0.8)';
            el.style.color = '#fff';
            el.style.fontFamily = "'Fira Code', monospace";
            el.style.fontSize = '24px';
            el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.45)';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0';
            el.style.transition = 'opacity 200ms ease-in-out';
            el.style.zIndex = '200';
            container.appendChild(el);
        }

        el.textContent = message;
        el.style.display = 'block';
        // force reflow to ensure transition runs
        void el.offsetWidth;
        el.style.opacity = '1';

        if (statusMessageTimeout) clearTimeout(statusMessageTimeout);
        statusMessageTimeout = setTimeout(() => {
            el.style.opacity = '0';
            statusMessageTimeout = setTimeout(() => {
                el.style.display = 'none';
            }, 250);
        }, Math.max(0, duration));
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

            const layerOpacity = getLayerOpacity(l);
            if (layerOpacity <= 0) continue;

            if (x < tilesX && y < tilesY) {
                const spriteInfo = placedSprites[`${l},${x},${y}`];
                //drawSprite(x, y, tileSizeX, tileSizeY, spriteInfo.sprite, spriteInfo.color); // draw sprite from sprite.js with array data
                if (spriteInfo) {
                    ctx.save();
                    ctx.globalAlpha = layerOpacity;
                    if (spriteInfo.type === 'passage') {
                        ctx.save()
                        ctx.globalAlpha = layerOpacity * 0.5
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
                    ctx.restore();
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

            const layerOpacity = getLayerOpacity(l);
            if (layerOpacity <= 0) continue;

            // If x and y are provided, only draw the sprite(s) at (x, y)
            if (x !== null && y !== null && (sx !== x || sy !== y)) continue;

            const spriteInfo = placedSprites[`${l},${sx},${sy}`];
            if (spriteInfo) {
                ctx.save();
                ctx.globalAlpha = layerOpacity;
                switch (spriteInfo.type) {
                    case 'passage':
                        ctx.save()
                        ctx.globalAlpha = layerOpacity * 0.5
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
                        ctx.globalAlpha = layerOpacity * 0.7;
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
                ctx.restore();
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

    // draw the top cursor with mode and layer indicators
    function drawCursor() {
        const posX = cursorX * tileSizeX;
        const posY = cursorY * tileSizeY;

        // Determine cursor color based on mode
        let cursorColor = 'rgba(255, 10, 10, 0.8)'; // Default red for draw mode
        let showModeLabel = false;
        let modeLabel = '';

        switch (mouse.mode) {
            case 'fill':
                cursorColor = 'rgba(0, 100, 255, 0.8)'; // Blue
                break;
            case 'paint':
                cursorColor = 'rgba(12, 248, 0, 0.8)'; // Hot pink
                break;
            case 'lighten':
                showModeLabel = true;
                modeLabel = 'L';
                break;
            case 'darken':
                showModeLabel = true;
                modeLabel = 'D';
                break;
        }

        // Draw cursor rectangle
        ctx.beginPath();
        ctx.lineWidth = 2;

        if (showModeLabel) {
            // Special handling for lighten/darken - dark sides, dark top/bottom
            ctx.strokeStyle = 'rgba(58, 58, 58, 0.6)';
            ctx.beginPath();
            ctx.moveTo(posX + 1, posY + 1);
            ctx.lineTo(posX + 1, posY + tileSizeY - 1); // Left side
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(posX + tileSizeX - 1, posY + 1);
            ctx.lineTo(posX + tileSizeX - 1, posY + tileSizeY - 1); // Right side
            ctx.stroke();

            ctx.strokeStyle = 'rgba(57, 57, 57, 0.8)';
            ctx.beginPath();
            ctx.moveTo(posX + 1, posY + 1);
            ctx.lineTo(posX + tileSizeX - 1, posY + 1); // Top
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(posX + 1, posY + tileSizeY - 1);
            ctx.lineTo(posX + tileSizeX - 1, posY + tileSizeY - 1); // Bottom
            ctx.stroke();

            // Draw inner white square for better visibility
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(posX + 4, posY + 4, tileSizeX - 8, tileSizeY - 8);
            ctx.lineWidth = 2; // Reset line width
        } else {
            ctx.strokeStyle = cursorColor;
            ctx.strokeRect(posX + 1, posY + 1, tileSizeX - 2, tileSizeY - 2);
        }

        // Draw layer number in upper right
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.font = 'bold 10px monospace';
        ctx.lineWidth = 2;
        const layerText = currentLayer.toString();
        const textX = posX + tileSizeX - 8;
        const textY = posY + 10;
        ctx.strokeText(layerText, textX, textY);
        ctx.fillText(layerText, textX, textY);

        // Draw mode label for lighten/darken in upper right (below layer number)
        if (showModeLabel) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeStyle = 'rgba(57, 57, 57, 0.9)';
            ctx.font = 'bold 9px monospace';
            const modeLabelX = posX + tileSizeX - 8;
            const modeLabelY = posY + 20;
            ctx.strokeText(modeLabel, modeLabelX, modeLabelY);
            ctx.fillText(modeLabel, modeLabelX, modeLabelY);
        }

        // Draw temporary intensity tooltip (centered in cursor)
        if (intensityTooltip.visible) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1;
            const tooltipText = colorIntensity.toString();
            ctx.font = '16px monospace';
            const textWidth = ctx.measureText(tooltipText).width;
            const centerX = posX + (tileSizeX - textWidth) / 2;
            const centerY = posY + tileSizeY / 2 + 6;
            //ctx.strokeText(tooltipText, centerX, centerY);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillText(tooltipText, centerX, centerY);
        }
    }

    // ######################################
    // PLACE SPRITE FUNCTIONS
    // ######################################

    // Flood fill algorithm.
    // Normal mode: fills all connected tiles that share the same sprite number as the starting tile
    //   (null = empty tile, so starting on empty fills connected empty space).
    // fillAllMatching mode (Shift): replaces every tile on the current layer that has the same
    //   sprite number as the starting tile, regardless of connectivity.
    // Never overwrites the player tile.
    function floodFill(startX, startY, newSpriteData, fillAllMatching = false) {
        const startKey = `${currentLayer},${startX},${startY}`;
        const startTile = placedSprites[startKey] || null;
        const startSprite = startTile ? startTile.sprite : null; // null means empty tile

        // True if this tile should be replaced
        function matches(key) {
            const tile = placedSprites[key] || null;
            if (tile && tile.type === 'player') return false; // never overwrite the player
            const tileSprite = tile ? tile.sprite : null;
            return tileSprite === startSprite;
        }

        function buildPayload(key) {
            const existing = placedSprites[key] || null;
            return {
                ...newSpriteData,
                layer: currentLayer,
                oldKey: key,
                type: newSpriteData.type || (existing ? existing.type : 'wall'),
            };
        }

        const eraseMode = newSpriteData.type === 'empty';

        if (fillAllMatching) {
            // Replace (or erase) every matching tile on this layer (non-contiguous global replace)
            for (let x = 0; x < tilesX; x++) {
                for (let y = 0; y < tilesY; y++) {
                    const key = `${currentLayer},${x},${y}`;
                    if (matches(key)) setTile(key, eraseMode ? null : buildPayload(key));
                }
            }
        } else {
            // Standard iterative 4-directional flood fill
            const stack = [[startX, startY]];
            const visited = new Set();

            while (stack.length > 0) {
                const [x, y] = stack.pop();
                if (x < 0 || y < 0 || x >= tilesX || y >= tilesY) continue;
                const key = `${currentLayer},${x},${y}`;
                if (visited.has(key)) continue;
                visited.add(key);
                if (!matches(key)) continue;

                setTile(key, eraseMode ? null : buildPayload(key));
                stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
        }

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

    function deepCopyTile(tile) {
        if (tile === null || tile === undefined) return tile;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(tile);
            } catch (err) {
                // Fallback
            }
        }
        return JSON.parse(JSON.stringify(tile));
    }

    function createEmptyHistory() {
        return {
            undoStack: [],
            redoStack: [],
            activeTransaction: null,
        };
    }

    function resetBoardHistory(boardId) {
        boardHistories[boardId] = createEmptyHistory();
        return boardHistories[boardId];
    }

    function getBoardHistory(boardId = currentBoard) {
        if (!boardHistories[boardId]) {
            return resetBoardHistory(boardId);
        }
        return boardHistories[boardId];
    }

    function recordHistoryEntry(entry) {
        if (suppressHistory) return;
        const history = getBoardHistory();
        if (history.activeTransaction) {
            history.activeTransaction.push(entry);
            return;
        }
        history.undoStack.push(entry);
        if (history.undoStack.length > historyLimit) {
            history.undoStack.shift();
        }
        history.redoStack.length = 0;
    }

    function beginHistoryTransaction() {
        const history = getBoardHistory();
        if (!history.activeTransaction) {
            history.activeTransaction = [];
        }
    }

    function commitHistoryTransaction() {
        const history = getBoardHistory();
        if (!history.activeTransaction || !history.activeTransaction.length) {
            history.activeTransaction = null;
            return;
        }
        const groupedEntry = {
            batch: history.activeTransaction.map((entry) => ({ ...entry }))
        };
        history.undoStack.push(groupedEntry);
        if (history.undoStack.length > historyLimit) {
            history.undoStack.shift();
        }
        history.redoStack.length = 0;
        history.activeTransaction = null;
    }

    function cancelHistoryTransaction() {
        const history = getBoardHistory();
        history.activeTransaction = null;
    }

    function setTile(tileKey, tileData, logHistory = true) {
        const previous = deepCopyTile(placedSprites[tileKey]);
        const next = tileData ? deepCopyTile(tileData) : null;

        if (next) {
            placedSprites[tileKey] = next;
        } else {
            delete placedSprites[tileKey];
        }

        if (logHistory) {
            recordHistoryEntry({
                key: tileKey,
                previous,
                next: next ? deepCopyTile(next) : null
            });
        }
    }

    function removeSprite(tileKey, logHistory = true) {
        if (!placedSprites[tileKey]) return;
        if (placedSprites[tileKey].type === 'player') return;
        setTile(tileKey, null, logHistory);
    }

    function clearHistory(targetBoardId = null) {
        if (targetBoardId !== null) {
            resetBoardHistory(targetBoardId);
            return;
        }
        if (boardList && boardList.length) {
            boardList.forEach(([boardId]) => {
                resetBoardHistory(boardId);
            });
        } else {
            Object.keys(boardHistories).forEach((boardId) => {
                resetBoardHistory(boardId);
            });
        }
        getBoardHistory(currentBoard);
    }

    function applyHistoryTile(tileKey, tileData) {
        if (tileData) {
            placedSprites[tileKey] = deepCopyTile(tileData);
        } else {
            delete placedSprites[tileKey];
        }
    }

    function refreshEditorAfterHistory() {
        drawBoard();
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
    }

    function undoAction() {
        const history = getBoardHistory();
        const entry = history.undoStack.pop();
        if (!entry) return;
        suppressHistory = true;
        if (entry.batch) {
            const reversed = [...entry.batch].reverse();
            reversed.forEach((item) => applyHistoryTile(item.key, item.previous));
        } else {
            applyHistoryTile(entry.key, entry.previous);
        }
        suppressHistory = false;
        history.redoStack.push(entry);
        refreshEditorAfterHistory();
    }

    function redoAction() {
        const history = getBoardHistory();
        const entry = history.redoStack.pop();
        if (!entry) return;
        suppressHistory = true;
        if (entry.batch) {
            entry.batch.forEach((item) => applyHistoryTile(item.key, item.next));
        } else {
            applyHistoryTile(entry.key, entry.next);
        }
        suppressHistory = false;
        history.undoStack.push(entry);
        refreshEditorAfterHistory();
    }

    function placeSprite(key, sprite, type, logHistory = true) {
        const tileKey = key;
        const tilePayload = {
            sprite: sprite,
            color: colors,
            type: type,
            layer: currentLayer,
            oldKey: tileKey,
            data: {},
        };

        if (type === 'object' || type === 'sign') {
            tilePayload.data = {
                name: '',
                speed: 2,
                timer: 0,
                script: tileData.script || '',
                scriptIndex: 0,
                text: '',
            };
        }

        if (type === 'passage') {
            tilePayload.data = {
                speed: 1,
                board: currentBoard,
            };
        }

        if (type === 'item' || type === 'coin' || type === 'ammo') {
            tilePayload.data = {
                value: currentAmount,
            };
        }

        setTile(tileKey, tilePayload, logHistory);
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
                    if (type === 'empty') {
                        removeSprite(tileKey); // Eraser mode: always delete
                    } else if (placedSprites[tileKey]) {
                        // Remove sprite if it exists (except player)
                        removeSprite(tileKey);
                    } else {
                        // Place sprite
                        placeSprite(tileKey, currentSprite, type); // Place sprite
                    }
                } else if (mouse.mode === 'fill') {
                    // Shift = fill ALL tiles on the layer with the same sprite (non-contiguous)
                    const fillAllMatching = event.shiftKey;

                    // Perform Flood Fill
                    beginHistoryTransaction();
                    try {
                        floodFill(cursorX, cursorY, {
                            sprite: currentSprite,
                            color: colors,
                            type: type,
                            data: getObjectData()
                        }, fillAllMatching);
                        commitHistoryTransaction();
                    } catch (err) {
                        console.error('Flood fill failed:', err);
                        cancelHistoryTransaction();
                    }

                    mouse.mode = 'draw'; // Reset mode after filling
                }

                else if (mouse.mode === 'darken') {
                    if (placedSprites[tileKey]) {
                        const updatedTile = deepCopyTile(placedSprites[tileKey]);
                        const factor = -colorIntensity / 100;
                        updatedTile.color = [
                            adjustColor(updatedTile.color[0], factor),
                            adjustColor(updatedTile.color[1], factor)
                        ];
                        setTile(tileKey, updatedTile);
                    }

                } else if (mouse.mode === 'lighten') {
                    if (placedSprites[tileKey]) {
                        const updatedTile = deepCopyTile(placedSprites[tileKey]);
                        const factor = colorIntensity / 100;
                        updatedTile.color = [
                            adjustColor(updatedTile.color[0], factor),
                            adjustColor(updatedTile.color[1], factor)
                        ];
                        setTile(tileKey, updatedTile);
                    }
                }
                break;
            case 1: // Middle mouse button (Adjust color)
                if (placedSprites[tileKey]) {
                    const updatedTile = deepCopyTile(placedSprites[tileKey]);
                    updatedTile.color = [
                        adjustColor(updatedTile.color[0], 0.1),
                        adjustColor(updatedTile.color[1], 0.1)
                    ];
                    setTile(tileKey, updatedTile);
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
        else if (quickMenuPopups.has(popup.type)) {
            closePopup();
            mouse.down = false;
            return;
        }
        else {
            // handle toolbar clicks from toolbar.js
            //toolbarClicked(x, y);
            colors = currentColors;
            console.log('toolbar clicked');
        }
    }

    function handleMouseMove(event) {
        canvas.style.cursor = 'default'; // reset cursor to default on every move. specific tool cursors will be set in drawCursor function

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
        clearHistory();
    }

    function handleLoadedWorld(spriteSheetData, boardListData, worldData, worldSettingsData = {}, boardSettingsData = {}) {
        boardList = boardListData || boardList; // Load the board list
        world = worldData || world; // Load the world data

        worldSaveData.worldSettings = Object.keys(worldSettingsData).length ? worldSettingsData : worldSaveData.worldSettings;
        worldSaveData.boardSettings = boardSettingsData || {};

        // Ensure every board has settings (fills in new defaults without overwriting existing values)
        boardList.forEach(([boardId, boardName]) => {
            initializeBoardSettings(boardId, { boardName: boardName });
        });

        replaceSpriteSheet(spriteSheetData); // Load the sprite sheet data

        hiddenLayers = new Set();
        const firstBoardId = boardList?.[0]?.[0] || 1;
        currentBoard = firstBoardId; // Set the current board to the first one
        placedSprites = world[currentBoard] || {}; // Get the current board from the world object
        world[currentBoard] = placedSprites;

        findPlayerSprite(); // Find the player sprite on the current board

        console.log('Loaded World');
        drawBoard();

        updateSpriteData(currentSprite);
        clearHistory();
    }

    function handleToolbarClick(options = {}) {
        if (options.popup) {
            togglePopup(options.popup);
            return;
        }
        if (options.history === 'undo') {
            undoAction();
            return;
        }
        if (options.history === 'redo') {
            redoAction();
            return;
        }
        if (options.layer !== undefined) {
            currentLayer = options.layer;
            showStatusMessage(`Current layer ${currentLayer}`);
        }
        if (options.hidden !== undefined) hiddenLayers = options.hidden;
        if (options.type !== undefined) type = options.type;
        if (options.mode !== undefined) mouse.mode = options.mode;
        if (options.current !== undefined) {
            currentSprite = options.current;
            updateSpriteData(currentSprite);
        }
        if (options.layerOpacity3 !== undefined) {
            const settings = getCurrentBoardSettings();
            settings.layer3Opacity = options.layerOpacity3;
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

    function boardInfo() { // Show the board info popup
        if (popup.active) closePopup();

        const boardInfoContainer = document.getElementById('boardInfoBox');
        const boardInfoContent = document.getElementById('boardInfoContent');

        if (!boardInfoContainer || !boardInfoContent) {
            console.warn('Board info popup container is missing.');
            return;
        }

        const boardId = currentBoard;
        const currentBoardData = boardList.find(board => board[0] === boardId);
        const boardName = currentBoardData ? currentBoardData[1] : `Board ${boardId}`;
        const settings = initializeBoardSettings(boardId, { boardName: boardName });

        // Build the UI inside the popup dynamically so it matches current data

        // Inputs
        const nameInput = document.getElementById('boardInfoName');
        const bulletLimitInput = document.getElementById('boardInfoBulletLimit');
        const startXInput = document.getElementById('boardInfoStartX');
        const startYInput = document.getElementById('boardInfoStartY');
        const startLayerInput = document.getElementById('boardInfoStartLayer');
        const reenterInput = document.getElementById('boardInfoReenter');
        const darkInput = document.getElementById('boardInfoDark');
        const nightInput = document.getElementById('boardInfoNight');
        const lockedInput = document.getElementById('boardInfoLocked');
        const canAttackInput = document.getElementById('boardInfoCanAttack');
        const northInput = document.getElementById('boardInfoNorth');
        const eastInput = document.getElementById('boardInfoEast');
        const southInput = document.getElementById('boardInfoSouth');
        const westInput = document.getElementById('boardInfoWest');
        const scriptInput = document.getElementById('boardInfoScript');

        // Populate board dropdowns with current board list
        const populateBoardSelect = (selectEl, currentValue) => {
            if (!selectEl) return;
            selectEl.innerHTML = '';
            const noneOption = document.createElement('option');
            noneOption.value = 'none';
            noneOption.textContent = 'None';
            selectEl.appendChild(noneOption);

            boardList.forEach(([id, name]) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = `${id}: ${name}`;
                selectEl.appendChild(opt);
            });

            const normalized = currentValue === null || currentValue === undefined ? 'none' : String(currentValue);
            selectEl.value = normalized;
        };

        populateBoardSelect(northInput, settings.linkedBoards?.north);
        populateBoardSelect(eastInput, settings.linkedBoards?.east);
        populateBoardSelect(southInput, settings.linkedBoards?.south);
        populateBoardSelect(westInput, settings.linkedBoards?.west);

        // Populate values
        nameInput.value = settings.boardName || boardName;
        bulletLimitInput.value = settings.bulletLimit || 0;
        startXInput.value = settings.playerStart?.x ?? 0;
        startYInput.value = settings.playerStart?.y ?? 0;
        startLayerInput.value = settings.playerStart?.layer ?? 2;
        reenterInput.checked = !!settings.reenterWhenHurt;
        darkInput.checked = !!settings.dark;
        nightInput.checked = !!settings.nightmode;
        lockedInput.checked = !!settings.playerLocked;
        canAttackInput.checked = !!settings.playerCanAttack;
        scriptInput.value = settings.boardScript || '';

        // Event handlers to keep data in sync
        nameInput.oninput = () => {
            const newName = nameInput.value.trim() || `Board ${boardId}`;
            settings.boardName = newName;
            if (currentBoardData) currentBoardData[1] = newName;
        };

        bulletLimitInput.oninput = () => {
            const parsed = parseInt(bulletLimitInput.value, 10);
            settings.bulletLimit = Number.isFinite(parsed) ? parsed : 0;
        };

        const updatePlayerStart = () => {
            settings.playerStart = {
                x: parseInt(startXInput.value, 10) || 0,
                y: parseInt(startYInput.value, 10) || 0,
                layer: parseInt(startLayerInput.value, 10) || 2
            };
        };
        startXInput.oninput = updatePlayerStart;
        startYInput.oninput = updatePlayerStart;
        startLayerInput.oninput = updatePlayerStart;

        reenterInput.onchange = () => {
            settings.reenterWhenHurt = reenterInput.checked;
        };

        darkInput.onchange = () => {
            settings.dark = darkInput.checked;
        };

        nightInput.onchange = () => {
            settings.nightmode = nightInput.checked;
        };

        lockedInput.onchange = () => {
            settings.playerLocked = lockedInput.checked;
        };

        canAttackInput.onchange = () => {
            settings.playerCanAttack = canAttackInput.checked;
        };

        const parseLinkedBoardValue = (input) => {
            if (!input) return null;
            const val = input.value;
            if (val === 'none' || val === '') return null;
            const parsed = parseInt(val, 10);
            return Number.isFinite(parsed) ? parsed : null;
        };

        const updateLinkedBoards = () => {
            settings.linkedBoards = {
                north: parseLinkedBoardValue(northInput),
                east: parseLinkedBoardValue(eastInput),
                south: parseLinkedBoardValue(southInput),
                west: parseLinkedBoardValue(westInput)
            };
        };
        [northInput, eastInput, southInput, westInput].forEach((input) => {
            if (!input) return;
            input.oninput = updateLinkedBoards;
        });

        scriptInput.oninput = () => {
            settings.boardScript = scriptInput.value;
        };

        const handleClose = (event) => {
            if (!popup.active || popup.type !== 'boardInfoBox') {
                document.removeEventListener('keydown', handleClose);
                return;
            }
            if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                closePopup();
                document.removeEventListener('keydown', handleClose);
            }
        };
        document.addEventListener('keydown', handleClose);

        popup.active = true;
        popup.type = 'boardInfoBox';
        overlay.style.display = 'block';
        boardInfoContainer.style.display = 'flex';
    }


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
                    showStatusMessage(`Selected Board: ${item[1]} (ID: ${item[0]})`); // Show status message with board name and ID
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
                clearHistory(newBoardId);
                createPlayerInBoard(newBoardId); // Create player in the new board
                // Initialize board settings for the new board
                initializeBoardSettings(newBoardId, {
                    boardName: newBoardName,
                    playerStart: { x: 10, y: 5, layer: 2 }
                });
                console.log('New Board Added: ', newBoardId, newBoardName);
                console.log('Board Settings:', worldSaveData.boardSettings[newBoardId]);

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

    const quickMenuPopups = new Set(['extraTerrain', 'extraItems', 'extraCreatures']);

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
            k: (tileKey) => {
                type = 'key'; // Set type to key item
                placeSprite(tileKey, currentSprite, 'key');
                closePopup();
            },
            d: (tileKey) => {
                type = 'door'; // Set type to door
                placeSprite(tileKey, currentSprite, 'door');
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
            a: (tileKey) => {
                type = 'animation'; // Set type to animation tile
                placeSprite(tileKey, currentSprite, 'animation');
                closePopup();
            },
            i: (tileKey) => {
                type = 'invisible'; // Set type to invisible tile
                placeSprite(tileKey, currentSprite, 'invisible'); // Place sprite
                closePopup();
            },
            e: (tileKey) => {
                type = 'empty'; // Set type to empty (eraser)
                closePopup();
            }
        },
        extraCreatures: {
            // Add key handlers for extraCreatures here
        },
    };

    function triggerPopupSelection(popupId, key) {
        if (!popupId || !key) return;
        const handlers = popupHandlers[popupId];
        if (!handlers) return;
        const handler = handlers[key];
        if (!handler) return;
        const tileKey = `${currentLayer},${cursorX},${cursorY}`;
        handler(tileKey);
        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
    }

    function attachPopupClickHandlers(popupId) {
        const container = document.getElementById(popupId);
        if (!container) return;
        const handlers = popupHandlers[popupId];
        if (!handlers) return;

        const interactiveElements = [];
        container.querySelectorAll('li').forEach((item) => {
            const keySpan = item.querySelector('span');
            const derivedKey = (item.dataset.popupKey || (keySpan ? keySpan.textContent : '')).trim().toLowerCase();
            if (!derivedKey || !handlers[derivedKey]) return;
            item.dataset.popupKey = derivedKey;
            interactiveElements.push(item);

            const description = item.nextElementSibling;
            if (description && description.classList.contains('fieldText')) {
                description.dataset.popupKey = derivedKey;
                interactiveElements.push(description);
            }
        });

        interactiveElements.forEach((element) => {
            element.classList.add('popupOption');
            element.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                triggerPopupSelection(popupId, element.dataset.popupKey);
            });
        });
    }

    function initializeQuickMenuInteractions() {
        quickMenuPopups.forEach((popupId) => attachPopupClickHandlers(popupId));
    }

    initializeQuickMenuInteractions();

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

    function openPopup(popupId) {
        if (!popupId) return;
        if (popup.active) {
            closePopup();
        }

        const popupElement = document.getElementById(popupId);
        if (!popupElement) return;

        popup.active = true;
        popup.type = popupId;
        overlay.style.display = 'block';
        popupElement.style.display = 'flex';
    }

    function togglePopup(popupId) {
        if (!popupId) return;
        if (popup.active && popup.type === popupId) {
            closePopup();
            return;
        }
        openPopup(popupId);
    }

    document.addEventListener('keydown', (event) => {
        if (!popup.active) return;
        if (!quickMenuPopups.has(popup.type)) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closePopup();
        }
    });

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

            canvas.style.cursor = 'none'; // Hide the default cursor when using keyboard controls

            if (!event.ctrlKey && !event.metaKey) {
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
                        if (mouse.mode === 'draw') {
                            if (placedSprites[tileKey] || type === 'empty') {
                                removeSprite(tileKey);
                            } else {
                                placeSprite(tileKey, currentSprite, type); // Place sprite
                            }
                        }
                        else if (mouse.mode === 'darken') {
                            if (type === 'empty') break; // Don't darken if no tile type is selected
                            if (placedSprites[tileKey]) {
                                const updatedTile = deepCopyTile(placedSprites[tileKey]);
                                const factor = -colorIntensity / 100;
                                updatedTile.color = [
                                    adjustColor(updatedTile.color[0], factor),
                                    adjustColor(updatedTile.color[1], factor)
                                ];
                                setTile(tileKey, updatedTile);
                            }
                        } else if (mouse.mode === 'lighten') {
                            if (type === 'empty') break; // Don't lighten if no tile type is selected
                            if (placedSprites[tileKey]) {
                                const updatedTile = deepCopyTile(placedSprites[tileKey]);
                                const factor = colorIntensity / 100;
                                updatedTile.color = [
                                    adjustColor(updatedTile.color[0], factor),
                                    adjustColor(updatedTile.color[1], factor)
                                ];
                                setTile(tileKey, updatedTile);
                            }
                        } else if (mouse.mode === 'fill') {
                            // Shift = fill ALL tiles on the layer with the same sprite (non-contiguous)
                            const fillAllMatching = event.shiftKey;

                            // Perform Flood Fill
                            beginHistoryTransaction();
                            try {
                                floodFill(cursorX, cursorY, {
                                    sprite: currentSprite,
                                    color: colors,
                                    type: type,
                                    data: getObjectData()
                                }, fillAllMatching);
                                commitHistoryTransaction();
                            } catch (err) {
                                console.error('Flood fill failed:', err);
                                cancelHistoryTransaction();
                            }
                            mouse.mode = 'draw'; // Switch back to draw mode after filling
                        }
                        event.preventDefault();
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
                        break;
                    case 'PageUp': // quickly switch boards (previous)
                        {
                            const currentIndex = boardList.findIndex(item => item[0] === currentBoard);
                            const previousIndex = (currentIndex - 1 + boardList.length) % boardList.length;
                            currentBoard = boardList[previousIndex][0];
                            placedSprites = world[currentBoard];
                            findPlayerSprite();
                            drawBoard();
                            console.log('Switched to previous board:', currentBoard);
                            showStatusMessage('Switched to previous board: ' + currentBoard);
                        }
                        break;
                    case 'PageDown': // quickly switch boards (next)
                        {
                            const currentIndex = boardList.findIndex(item => item[0] === currentBoard);
                            const nextIndex = (currentIndex + 1) % boardList.length;
                            currentBoard = boardList[nextIndex][0];
                            placedSprites = world[currentBoard];
                            findPlayerSprite();
                            drawBoard();
                            console.log('Switched to next board:', currentBoard);
                            showStatusMessage('Switched to next board: ' + currentBoard);
                        }
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
                                    removeSprite(key);
                                }
                            }
                            showStatusMessage('All sprites in layer ' + currentLayer + ' deleted');
                            drawBoard();
                        }
                        break;
                    case 'backspace': // delete sprite on cursor and set type to 'empty'
                        if (placedSprites[tileKey]) {
                            removeSprite(tileKey);
                            type = 'empty';
                            showStatusMessage('Sprite removed');
                            drawBoard();
                        }
                        break;
                    case 'F1': //save world
                        saveWorld(getSpriteSheet(), boardList, world, worldSaveData.worldSettings, worldSaveData.boardSettings); // save world from file.js
                        if (event.repeat) { return }
                        break;
                    case 'F3': //load world
                        loadWorld(handleLoadedWorld); // load world from file.js
                        if (event.repeat) { return }
                        break;
                    case 'F9': // extra terrain tiles
                        togglePopup('extraTerrain');
                        if (event.repeat) { return }
                        break;
                    case 'F10': // extra item tiles
                        togglePopup('extraItems');
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
                    case 'x':
                        // Swap light and dark colors
                        colors = toolbarSwapColor();
                        updateColor(colors);
                        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
                        drawBoard();
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
                        updateLayers(currentLayer);
                        if (event.repeat) { return }
                        drawBoard();
                        toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
                        return;
                    case 's': // Save board & sprite sheet
                        saveCombinedData(getSpriteSheet(), placedSprites); // save board and sprite sheet from file.js and sprite-sheet.js
                        showStatusMessage('Board and Sprite Sheet saved');
                        break;
                    case 'l': // load board & sprite sheet
                        loadCombinedData(handleLoadedBoard); // load board and sprite sheet from file.js
                        showStatusMessage('Board and Sprite Sheet loaded');
                        break;
                    case 'i': // open board info popup
                        boardInfo();
                        break;
                    case 'r': // reset board
                        if (confirm('Are you sure you want reset board?')) {
                            const existingKeys = Object.keys(placedSprites);
                            beginHistoryTransaction();
                            try {
                                // Remove everything on the board
                                existingKeys.forEach(key => setTile(key, null));

                                // Recreate the player sprite and log it in history
                                const playerKey = `${player.layer},${player.x},${player.y}`;
                                const playerPayload = {
                                    sprite: 1,
                                    image: getSpriteImage(),
                                    color: [[0, 0, 255, .5], [255, 255, 255, 1]],
                                    type: 'player',
                                    direction: 'down',
                                    layer: player.layer,
                                    oldKey: playerKey,
                                };
                                setTile(playerKey, playerPayload);

                                // Update world reference after reset
                                world[currentBoard] = placedSprites;

                                console.log('Board reset');
                            } finally {
                                commitHistoryTransaction();
                            }

                            showStatusMessage("Board's been reset");
                            drawBoard(); // Redraw the board
                        } else {
                            console.log('Board not reset');
                        }
                        break;
                    case 'f': // flood fill
                        mouse.mode = 'fill';
                        console.log('flood fill mode');
                        break;
                    case 'd': // draw mode
                        mouse.mode = 'draw';
                        console.log('draw mode');
                        break;
                    case '/': // lighten brush mode
                        mouse.mode = 'lighten';
                        console.log('lighten mode');
                        break;
                    case '*': // darken brush mode
                        mouse.mode = 'darken';
                        console.log('darken mode');
                        break;
                    case '[':
                        if (colorIntensity > 1) {
                            colorIntensity--;
                            console.log('Color intensity:', colorIntensity);
                            showIntensityTooltip();
                        }
                        break;
                    case ']':
                        if (colorIntensity < 50) {
                            colorIntensity++;
                            console.log('Color intensity:', colorIntensity);
                            showIntensityTooltip();
                        }
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
            }

            if (event.ctrlKey || event.metaKey) {
                // Handle key combinations for both Windows/Linux (Ctrl) and Mac (Cmd)
                key.ctrl = true;
                switch (event.key.toLowerCase()) { // Check the key
                    case 'z':
                        if (event.shiftKey) {
                            redoAction();
                            showStatusMessage('Redo');
                        } else {
                            undoAction();
                            showStatusMessage('Undo');
                        }
                        if (event.repeat) { return }
                        return;
                    case 'y':
                        redoAction();
                        showStatusMessage('Redo');
                        if (event.repeat) { return }
                        return;
                    case 'b': // Handle 'Ctrl + B' to load board (no sprite sheet)
                        loadBoard(handleLoadedBoard); // from file.js
                        showStatusMessage('Board loaded');
                        if (event.repeat) { return }
                        return;
                    case 'n':
                        if (!event.ctrlKey) saveBoard(placedSprites); // save board (not sprite sheet)
                        if (event.repeat) { return }
                        break;
                    case 's': // save sprite sheet only
                        saveSpriteSheet(getSpriteSheet()); // UPDATE
                        showStatusMessage('Sprite sheet saved');
                        if (event.repeat) { return }
                        break;
                    case 'l': // load sprite sheet only
                        loadSpriteSheet(handleLoadedSpriteSheet); // UPDATE
                        showStatusMessage('Sprite sheet loaded');
                        if (event.repeat) { return }
                        break;
                    case 'r': // reset current layer
                        if (confirm('Are you sure you want reset this layer?')) {
                            beginHistoryTransaction();
                            try {
                                for (let key in placedSprites) {
                                    const [layer] = key.split(',').map(Number); // Extract layer from key
                                    if (layer === currentLayer) {
                                        removeSprite(key);
                                    }
                                }
                            } finally {
                                commitHistoryTransaction();
                            }
                        }
                        showStatusMessage(`Layer ${currentLayer} reset`);
                        if (event.repeat) { return }
                        break;
                    case 'c': // copy board to clipboard
                        navigator.clipboard.writeText(JSON.stringify(placedSprites))
                            .then(() => console.log('Board copied to clipboard'))
                            .catch(err => console.error('Copy failed:', err));
                        showStatusMessage('Board copied to clipboard');
                        if (event.repeat) { return }
                        break;
                    case 'v': // paste board from clipboard
                        navigator.clipboard.readText()
                            .then(text => {
                                const data = JSON.parse(text);
                                if (data && typeof data === 'object') {
                                    placedSprites = data;
                                    world[currentBoard] = placedSprites;
                                    drawBoard();
                                    toolbar(currentSprite, colors, currentLayer, mouse, hiddenLayers, handleToolbarClick, type);
                                    clearHistory();
                                    console.log('Board pasted from clipboard');
                                }
                            })
                            .catch(err => console.error('Paste failed:', err));
                        showStatusMessage('Board pasted from clipboard');
                        if (event.repeat) { return }
                        break;
                }
            }
        } // end of popup check

        if (popup.active) {
            if ((event.key === 'Escape' || event.key === 'Enter') && !enterPressed) {
                closePopup();
                return;
            }
            const handlers = popupHandlers[popup.type];
            if (handlers && handlers[event.key.toLowerCase()]) {
                handlers[event.key.toLowerCase()](tileKey); // Call the appropriate handler
                if (event.repeat) return;
            }
        }

        /*if (mouse.mode === 'paint') {
            if (placedSprites[tileKey] && placedSprites[tileKey].type === 'player');
            else placeSprite(tileKey, currentSprite, type); // Place sprite
        }*/

        if (mouse.mode === 'paint') {
            const tileKey = `${currentLayer},${cursorX},${cursorY}`;

            // Skip the player tile regardless
            if (!(placedSprites[tileKey] && placedSprites[tileKey].type === 'player')) {
                if (type === 'empty') {
                    removeSprite(tileKey); // Eraser mode: delete tile
                } else {
                    placeSprite(tileKey, currentSprite, type);
                }
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
    clearHistory();
});