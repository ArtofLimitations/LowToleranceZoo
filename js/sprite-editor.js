import { createDataURL, updateSpriteImage } from './sprite.js';
import { addToSpriteSheet, getDataFromSheet } from './sprite-sheet.js';

// Get the spriteCanvas element and context
const spriteCanvas = document.getElementById('spriteCanvas');
const spriteCtx = spriteCanvas.getContext('2d');
const container = document.getElementById('spriteContainer');
const overlay = document.getElementById('overlay');
const spriteNumber = document.getElementById('spriteEditorCurrentSprite');
const spritePreview = document.getElementById('spriteEditorCurrentSpriteImage');

// Set up the grid and colors
const gridSize = 16;
const pixelSize = Math.min(spriteCanvas.width, spriteCanvas.height) / gridSize;
const colors = ['white', 'black'];                                                // Only two colors: white and black
const maxSprites = 300; // Maximum number of sprites, can be changed later
let currentColor = 1;
let currentSprite = 1;
let clipboard = [];
export let spriteData = Array(gridSize).fill().map(() => Array(gridSize).fill(2)); // 16x16 grid, initially all alpha (2)
let [cursorX, cursorY] = [9, 4];
let mouse = {
    x: 0,
    y: 0,
    down: false,
    button: 0,
    mode: 'draw',
    ctrl: false,
};

let spriteSheet = {};
let undoStack = [];
let redoStack = [];
const historyLimit = 100;
let isDrawingUndoGroup = false;
let drawingHistorySnapshot = null;

// Optional callback to notify caller (main.js) when editor closes or changes current sprite
let onCloseCallback = null;

const sidebarColorButtons = {
    dark: document.getElementById('spriteButtonDark'),
    light: document.getElementById('spriteButtonLight'),
};

const sidebarActionButtons = {
    copy: document.getElementById('spriteButtonCopy'),
    paste: document.getElementById('spriteButtonPaste'),
    flipY: document.getElementById('spriteButtonFlipY'),
    flipX: document.getElementById('spriteButtonFlipX'),
    rotateL: document.getElementById('spriteButtonRotateL'),
    rotateR: document.getElementById('spriteButtonRotateR'),
    undo: document.getElementById('spriteButtonUndo'),
    redo: document.getElementById('spriteButtonRedo'),
    clear: document.getElementById('spriteButtonClear'),
    invert: document.getElementById('spriteButtonInvert'),
    delDark: document.getElementById('spriteButtonDelDark'),
    delLight: document.getElementById('spriteButtonDelLight'),
    nudgeUp: document.getElementById('spriteButtonNUP'),
    nudgeDown: document.getElementById('spriteButtonNDOWN'),
    nudgeLeft: document.getElementById('spriteButtonNLEFT'),
    nudgeRight: document.getElementById('spriteButtonNRIGHT'),

};

function syncSidebarColorButtons() {
    if (!sidebarColorButtons.dark || !sidebarColorButtons.light) return;

    const isDark = currentColor === 1;
    sidebarColorButtons.dark.classList.toggle('modeButton-active', isDark);
    sidebarColorButtons.light.classList.toggle('modeButton-active', !isDark);
}

function setSpriteColor(color) {
    currentColor = color;
    syncSidebarColorButtons();
}

function areSpriteDataEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let y = 0; y < a.length; y++) {
        const rowA = a[y];
        const rowB = b[y];
        if (!Array.isArray(rowA) || !Array.isArray(rowB) || rowA.length !== rowB.length) return false;
        for (let x = 0; x < rowA.length; x++) {
            if (rowA[x] !== rowB[x]) return false;
        }
    }
    return true;
}

function resetSpriteHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    isDrawingUndoGroup = false;
    drawingHistorySnapshot = null;
}

function pushSpriteHistory(previous, next, label = '') {
    if (areSpriteDataEqual(previous, next)) return;
    if (undoStack.length >= historyLimit) undoStack.shift();
    undoStack.push({ previous: structuredClone(previous), next: structuredClone(next), label });
    redoStack.length = 0;
}

function applySpriteState(state) {
    spriteData = structuredClone(state);
    drawGrid();
}

function undoSpriteAction() {
    if (!undoStack.length) return;
    const entry = undoStack.pop();
    redoStack.push({ previous: structuredClone(entry.previous), next: structuredClone(entry.next), label: entry.label });
    applySpriteState(entry.previous);
}

function redoSpriteAction() {
    if (!redoStack.length) return;
    const entry = redoStack.pop();
    undoStack.push({ previous: structuredClone(entry.previous), next: structuredClone(entry.next), label: entry.label });
    applySpriteState(entry.next);
}

const onSpriteMouseUp = () => {
    mouse.down = false;
    commitSpriteDrawHistory();
};

const onSpriteMouseLeave = () => {
    mouse.down = false;
    commitSpriteDrawHistory();
};

const onSpriteKeyUp = () => {
    mouse.ctrl = false;
};

/*function redoSpriteAction() {
    if (!redoStack.length) return;
    const entry = redoStack.pop();
    undoStack.push({ previous: structuredClone(entry.previous), next: structuredClone(entry.next), label: entry.label });
    applySpriteState(entry.next);
}*/

function beginSpriteDrawHistory() {
    if (!isDrawingUndoGroup) {
        drawingHistorySnapshot = structuredClone(spriteData);
        isDrawingUndoGroup = true;
    }
}

function commitSpriteDrawHistory() {
    if (!isDrawingUndoGroup) return;
    const before = drawingHistorySnapshot;
    const after = spriteData;
    isDrawingUndoGroup = false;
    drawingHistorySnapshot = null;
    pushSpriteHistory(before, after, 'draw');
}

function handleSidebarAction(action) {
    switch (action) {
        case 'copy':
            clipboard = structuredClone(spriteData);
            console.log('Sprite copied to clipboard');
            break;
        case 'paste': {
            const before = structuredClone(spriteData);
            if (clipboard && clipboard.length) {
                spriteData = structuredClone(clipboard);
                drawGrid();
                pushSpriteHistory(before, spriteData, 'paste');
            } else {
                console.log('Clipboard is empty. Copy data first.');
            }
            break;
        }
        case 'flipY': {
            const before = structuredClone(spriteData);
            spriteData = [...spriteData].reverse();
            drawGrid();
            pushSpriteHistory(before, spriteData, 'flipY');
            break;
        }
        case 'flipX': {
            const before = structuredClone(spriteData);
            spriteData = spriteData.map(row => [...row].reverse());
            drawGrid();
            pushSpriteHistory(before, spriteData, 'flipX');
            break;
        }
        case 'clear': {
            if (confirm('Are you sure you want to clear the sprite?')) {
                const before = structuredClone(spriteData);
                spriteData = Array(gridSize).fill().map(() => Array(gridSize).fill(2));
                drawGrid();
                pushSpriteHistory(before, spriteData, 'clear');
                console.log('Cleared sprite');
            }
            break;
        }
        case 'rotateL': {
            const before = structuredClone(spriteData);
            spriteData = spriteData[0].map((val, index) => spriteData.map(row => row[row.length - 1 - index]));
            drawGrid();
            pushSpriteHistory(before, spriteData, 'rotateL');
            break;
        }
        case 'rotateR': {
            const before = structuredClone(spriteData);
            spriteData = spriteData[0].map((val, index) => spriteData.map(row => row[index]).reverse());
            drawGrid();
            pushSpriteHistory(before, spriteData, 'rotateR');
            break;
        }
        case 'invert': {
            const before = structuredClone(spriteData);
            spriteData = invertColor();
            drawGrid();
            pushSpriteHistory(before, spriteData, 'invert');
            break;
        }
        case 'delDark': {
            const before = structuredClone(spriteData);
            spriteData = spriteData.map(row => row.map(value => value === 1 ? 2 : value));
            drawGrid();
            pushSpriteHistory(before, spriteData, 'delDark');
            break;
        }
        case 'delLight': {
            const before = structuredClone(spriteData);
            spriteData = spriteData.map(row => row.map(value => value === 0 ? 2 : value));
            drawGrid();
            pushSpriteHistory(before, spriteData, 'delLight');
            break;
        }
        case 'nudgeUp': {
            const before = structuredClone(spriteData);
            spriteData = nudgeSprite(spriteData, 'up');
            drawGrid();
            pushSpriteHistory(before, spriteData, 'nudgeUp');
            break;
        }
        case 'nudgeDown': {
            const before = structuredClone(spriteData);
            spriteData = nudgeSprite(spriteData, 'down');
            drawGrid();
            pushSpriteHistory(before, spriteData, 'nudgeDown');
            break;
        }
        case 'nudgeLeft': {
            const before = structuredClone(spriteData);
            spriteData = nudgeSprite(spriteData, 'left');
            drawGrid();
            pushSpriteHistory(before, spriteData, 'nudgeLeft');
            break;
        }
        case 'nudgeRight': {
            const before = structuredClone(spriteData);
            spriteData = nudgeSprite(spriteData, 'right');
            drawGrid();
            pushSpriteHistory(before, spriteData, 'nudgeRight');
            break;
        }
        case 'undo':
            undoSpriteAction();
            break;
        case 'redo':
            redoSpriteAction();
            break;
    }
}

function drawSpritePreview() {
    if (!spritePreview) return;

    spritePreview.innerHTML = '';
    createDataURL(spriteData, [0, 0, 0, 1], [255, 255, 255, 1])
        .then((img) => {
            img.style.width = '32px';
            img.style.height = '32px';
            //img.style.imageRendering = 'pixelated';
            //img.style.display = 'block';
            spritePreview.appendChild(img);
            //spritePreview.style.backgroundImage = img;
        })
        .catch((error) => {
            console.error('Error creating sprite preview:', error);
        });
}

// Function to draw the grid and sprite data
function drawGrid() {
    spriteCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
    //beginPath();
    //spriteCtx.fillStyle = '#1f1f1f';
    //spriteCtx.fillRect(0, 0, spriteCanvas.width, spdrawButtons riteCanvas.height);
    //beginPath();
    spriteCtx.fillStyle = '#addcca';
    spriteCtx.font = '12px Helvetica, Arial, Sans-Serif';

    if (mouse.mode === 'draw') document.getElementById('spriteDrawMode').textContent = 'Draw';
    if (mouse.mode === 'fill') document.getElementById('spriteDrawMode').textContent = 'Fill';

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (spriteData[y][x] !== 2) {
                spriteCtx.fillStyle = colors[spriteData[y][x]];
                spriteCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
            spriteCtx.strokeStyle = '#888';
            spriteCtx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            spriteCtx.beginPath();
        }
    }
    drawSpritePreview();
}

function draw(event) {
    // code to draw
    //event.preventDefault()
    const rect = spriteCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const x = Math.floor((event.clientX - rect.left) / pixelSize);
    const y = Math.floor((event.clientY - rect.top) / pixelSize);
    //console.log(x * pixelSize);

    if (x < gridSize && y < gridSize) {
        beginSpriteDrawHistory();
        switch (mouse.button) {
            case 0:
                spriteData[y][x] = currentColor;
                break;
            case 2:
                spriteData[y][x] = 2;
                break;
        }
        drawGrid();
    }
}

function floodFill(x, y, targetColor, fillColor) {
    // Check bounds and ensure we only fill pixels of the target color
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || spriteData[y][x] !== targetColor) {
        return;
    }

    // Set the current pixel to the fill color
    spriteData[y][x] = fillColor;

    // Recursively fill neighboring pixels (4-way: up, down, left, right)
    floodFill(x + 1, y, targetColor, fillColor);
    floodFill(x - 1, y, targetColor, fillColor);
    floodFill(x, y + 1, targetColor, fillColor);
    floodFill(x, y - 1, targetColor, fillColor);
}

// Function to handle mouse clicks and toggle pixel color
function handlespriteCanvasClick(event) {
    mouse.down = true;
    mouse.button = event.button;
    if (mouse.mode === 'fill') {
        const rect = spriteCanvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / pixelSize);
        const y = Math.floor((event.clientY - rect.top) / pixelSize);
        const targetColor = spriteData[y][x];
        console.log(`target: ${spriteData[y][x]} current: ${currentColor}`);

        if (targetColor !== currentColor) {
            const before = structuredClone(spriteData);
            floodFill(x, y, targetColor, currentColor);
            drawGrid();
            pushSpriteHistory(before, spriteData, 'fill');
        }
        mouse.down = false;
        mouse.mode = 'draw';
        return;
    }
    draw(event);
}

// Replace all occurrences of 0 with 1
function invertColor() {
    console.log('inverted');
    return spriteData.map(row => row.map(value => value === 0 ? 1 : value === 1 ? 0 : value));
}

// Nudges the sprite data in the specified direction.
function nudgeSprite(spriteData, direction) {
    const size = gridSize; // Assuming a 16x16 array
    const newData = Array.from({ length: size }, () => Array(size).fill(0));

    if (direction === "up") {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                newData[y][x] = spriteData[(y + 1) % size][x]; // Wrap around to the bottom
            }
        }
    } else if (direction === "down") {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                newData[y][x] = spriteData[(y - 1 + size) % size][x]; // Wrap around to the top
            }
        }
    } else if (direction === "left") {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                newData[y][x] = spriteData[y][(x + 1) % size]; // Wrap around to the right
            }
        }
    } else if (direction === "right") {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                newData[y][x] = spriteData[y][(x - 1 + size) % size]; // Wrap around to the left
            }
        }
    } else {
        console.error("Invalid direction. Use 'up', 'down', 'left', or 'right'.");
        return spriteData;
    }

    return newData;
}

function handleMouseMove(event) {
    // detect possible changes in mouse position
    if (mouse.down) {
        const rect = spriteCanvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / pixelSize);
        const y = Math.floor((event.clientY - rect.top) / pixelSize);
        if (mouse.x != x || mouse.y != y) {
            mouse.x = x;
            mouse.y = y;
            if (mouse.mode === 'draw' && mouse.x >= 0 && mouse.y >= 0 && mouse.x < gridSize && mouse.y < gridSize) {
                draw(event);
            }
        }
    }
}

function handleKeyboard(event) {

    switch (event.key) {

        case 'ctrlKey':
            mouse.ctrl = true;
            break;
        case 'F':
        case 'f':
            mouse.mode = 'fill';
            drawGrid();
            break;
        case 'D':
        case 'd':
            mouse.mode = 'draw';
            drawGrid();
            break;
        case '1':
            setSpriteColor(1);
            break;
        case '2':
            setSpriteColor(0);
            break;
        case 'z':
        case 'Z':
            if (event.ctrlKey || event.metaKey) {
                undoSpriteAction();
                return;
            }
            break;
        case 'y':
        case 'Y':
            if (event.ctrlKey || event.metaKey) {
                redoSpriteAction();
                return;
            }
            break;
        case "!": // delete all dark
            spriteData = spriteData.map(row => row.map(value => value === 1 ? 2 : value));
            drawGrid();
            drawSpritePreview();
            break;
        case "@": // delete all light
            spriteData = spriteData.map(row => row.map(value => value === 0 ? 2 : value));
            drawGrid();
            drawSpritePreview();
            break;
        case 'I':
        case 'i':
            console.log(invertColor());
            spriteData = invertColor();
            drawGrid();
            drawSpritePreview();
            break;
        case '+':
        case '=':
        case 'NumpadAdd':
            if (currentSprite < maxSprites) {
                // Save current edits before switching
                try {
                    const imageData = updateSpriteImage(spriteData);
                    addToSpriteSheet(currentSprite, spriteData, imageData);
                } catch (e) { console.warn('Failed to save sprite before switching', e); }
                currentSprite++;
                updateSpriteData(currentSprite);
                spriteNumber.innerText = currentSprite;
                drawGrid();
                // notify caller of change
                if (onCloseCallback) onCloseCallback(currentSprite);
            }
            drawSpritePreview();
            break;
        case '-':
        case '_':
        case 'NumpadSubtract':
            if (currentSprite > 1) {
                try {
                    const imageData = updateSpriteImage(spriteData);
                    addToSpriteSheet(currentSprite, spriteData, imageData);
                } catch (e) { console.warn('Failed to save sprite before switching', e); }
                currentSprite--;
                updateSpriteData(currentSprite);
                spriteNumber.innerText = currentSprite;
                drawGrid();
                if (onCloseCallback) onCloseCallback(currentSprite);
            }
            drawSpritePreview();
            break;
        case '%': // generate a checked pattern sprite
            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    spriteData[y][x] = (x + y) % 2 === 0 ? 1 : 0;
                }
            }
            drawGrid();
            drawSpritePreview();
            break;
        case '^': // generate a striped pattern sprite (checkered but 2 pixels down, 1 pixel right)
            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    spriteData[y][x] = (Math.floor(y / 2) + x) % 2 === 0 ? 1 : 0;
                }
            }
            drawGrid();
            drawSpritePreview();
            break;
        case 'Escape':
            removeSpriteEvents()
            container.style.display = 'none';
            const imageData = updateSpriteImage(spriteData);         // in sprite.js
            addToSpriteSheet(currentSprite, spriteData, imageData);  // in sprite-sheet.js
            overlay.style.display = 'none';
            addMainEvents();
            if (onCloseCallback) {
                try { onCloseCallback(currentSprite); } catch (e) { console.warn('onCloseCallback failed', e); }
                onCloseCallback = null;
            }
    }

    switch (event.code) { // Handles numpad keys
        case 'Numpad8':
            spriteData = nudgeSprite(spriteData, "up");
            drawGrid();
            break;
        case 'Numpad2':
            spriteData = nudgeSprite(spriteData, "down");
            drawGrid();
            break;
        case 'Numpad4':
            spriteData = nudgeSprite(spriteData, "left");
            drawGrid();
            break;
        case 'Numpad6':
            spriteData = nudgeSprite(spriteData, "right");
            drawGrid();
    }
}

function addSpriteEvents() {
    // Add events for sprite editor
    // Event listeners for mouse click
    spriteCanvas.addEventListener('mousedown', handlespriteCanvasClick);
    spriteCanvas.addEventListener('mouseup', onSpriteMouseUp);
    spriteCanvas.addEventListener('mousemove', handleMouseMove);
    spriteCanvas.addEventListener('mouseleave', onSpriteMouseLeave);

    if (sidebarColorButtons.dark) {
        sidebarColorButtons.dark.onclick = () => setSpriteColor(1);
    }
    if (sidebarColorButtons.light) {
        sidebarColorButtons.light.onclick = () => setSpriteColor(0);
    }
    if (sidebarActionButtons.copy) {
        sidebarActionButtons.copy.onclick = () => handleSidebarAction('copy');
    }
    if (sidebarActionButtons.paste) {
        sidebarActionButtons.paste.onclick = () => handleSidebarAction('paste');
    }
    if (sidebarActionButtons.flipY) {
        sidebarActionButtons.flipY.onclick = () => handleSidebarAction('flipY');
    }
    if (sidebarActionButtons.flipX) {
        sidebarActionButtons.flipX.onclick = () => handleSidebarAction('flipX');
    }
    if (sidebarActionButtons.rotateL) {
        sidebarActionButtons.rotateL.onclick = () => handleSidebarAction('rotateL');
    }
    if (sidebarActionButtons.rotateR) {
        sidebarActionButtons.rotateR.onclick = () => handleSidebarAction('rotateR');
    }
    if (sidebarActionButtons.clear) {
        sidebarActionButtons.clear.onclick = () => handleSidebarAction('clear');
    }
    if (sidebarActionButtons.invert) {
        sidebarActionButtons.invert.onclick = () => handleSidebarAction('invert');
    }
    if (sidebarActionButtons.delDark) {
        sidebarActionButtons.delDark.onclick = () => handleSidebarAction('delDark');
    }
    if (sidebarActionButtons.delLight) {
        sidebarActionButtons.delLight.onclick = () => handleSidebarAction('delLight');
    }
    if (sidebarActionButtons.nudgeUp) {
        sidebarActionButtons.nudgeUp.onclick = () => handleSidebarAction('nudgeUp');
    }
    if (sidebarActionButtons.nudgeDown) {
        sidebarActionButtons.nudgeDown.onclick = () => handleSidebarAction('nudgeDown');
    }
    if (sidebarActionButtons.nudgeLeft) {
        sidebarActionButtons.nudgeLeft.onclick = () => handleSidebarAction('nudgeLeft');
    }
    if (sidebarActionButtons.nudgeRight) {
        sidebarActionButtons.nudgeRight.onclick = () => handleSidebarAction('nudgeRight');
    }
    if (sidebarActionButtons.undo) {
        sidebarActionButtons.undo.onclick = () => handleSidebarAction('undo');
    }
    if (sidebarActionButtons.redo) {
        sidebarActionButtons.redo.onclick = () => handleSidebarAction('redo');
    }

    // Event listener for keyboard
    document.addEventListener('keydown', handleKeyboard);
    document.addEventListener('keyup', onSpriteKeyUp);
}

function removeSpriteEvents() {
    // Add events for sprite editor
    // Event listeners for mouse click
    spriteCanvas.removeEventListener('mousedown', handlespriteCanvasClick);
    spriteCanvas.removeEventListener('mouseup', onSpriteMouseUp);
    spriteCanvas.removeEventListener('mousemove', handleMouseMove);
    spriteCanvas.removeEventListener('mouseleave', onSpriteMouseLeave);
    // Event listener for keyboard
    document.removeEventListener('keydown', handleKeyboard);
    document.removeEventListener('keyup', onSpriteKeyUp);
}

export function updateSpriteData(current) {
    const data = getDataFromSheet(current);
    if (data !== undefined && data !== null) {
        spriteData = data;
    }
    else {
        console.log('creating new sprite')
        spriteData = Array(gridSize).fill().map(() => Array(gridSize).fill(2));
    }
    resetSpriteHistory();
    drawGrid();
}

export function editSprite(current, onClose = null) {
    //container.hidden = container.hidden === false ? true : false;
    //container.style.display = container.style.display === 'block' ? 'none' : 'block';
    container.style.display = 'block';
    currentSprite = current;
    onCloseCallback = onClose;

    // add event listeners
    addSpriteEvents();
    syncSidebarColorButtons();

    // Initial draw
    drawGrid();
}