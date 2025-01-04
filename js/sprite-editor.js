import { updateSpriteImage } from './sprite.js';
import { addToSpriteSheet, getDataFromSheet } from './sprite-sheet.js';

// Get the spriteCanvas element and context
const spriteCanvas = document.getElementById('spriteCanvas');
const spriteCtx = spriteCanvas.getContext('2d');
const container = document.getElementById('spriteContainer');

// Set up the grid and colors
// Grid width 520px
const gridSize = 16;
const sidebar = 64;
const pixelSize = (spriteCanvas.width - sidebar) / gridSize;
const colors = ['white', 'black'];                                                 // Only two colors: white and black
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

const buttons = [
    { x: 8, y: 100, width: 48, height: 40, label: 'Dark' },
    { x: 8, y: 150, width: 48, height: 40, label: 'Light' },
    //{ x: 8, y: 200, width: 48, height: 40, label: 'Alpha' },
    { x: 8, y: 200, width: 48, height: 40, label: 'Copy' },
    { x: 8, y: 250, width: 48, height: 40, label: 'Paste' },
    { x: 8, y: 350, width: 48, height: 40, label: 'FlipY' },
    { x: 8, y: 400, width: 48, height: 40, label: 'FlipX' },
    { x: 8, y: 450, width: 48, height: 40, label: 'CLR' }
]

function isInsideButton(bX, x, y, button) {
    //console.log(`offset: ${bX} X: ${x} Y: ${y}`);
    return (
        x > bX + button.x && x < bX + button.x + button.width &&
        y > button.y && y < button.y + button.height
    );
}

function drawButtons() {
    buttons.forEach(button => {
        //spriteCtx.fillStyle = '#9ed474';
        if (currentColor === 1 && button.label === 'Dark') {
            spriteCtx.fillStyle = '#576b47';
        } else if (currentColor === 0 && button.label === 'Light') {
            spriteCtx.fillStyle = '#576b47';
        } else {
            spriteCtx.fillStyle = '#fff';//'#d2ebbe';
        }
        spriteCtx.fillRect(spriteCanvas.width - sidebar + button.x, button.y, button.width, button.height);
        spriteCtx.fillStyle = '#222';
        spriteCtx.font = 'bold 14px Arial';
        spriteCtx.fillText(button.label, spriteCanvas.width - sidebar + button.x + 8, button.y + 25);
    });
}

// Function to draw the grid and sprite data
function drawGrid() {
    spriteCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height); // clear
    spriteCtx.beginPath();                                              // draw sidebar
    spriteCtx.fillStyle = '#2c3d63';
    spriteCtx.fillRect(spriteCanvas.width - sidebar, 0, spriteCanvas.width, spriteCanvas.height);
    spriteCtx.beginPath();
    spriteCtx.fillStyle = "#addcca";
    spriteCtx.font = "12px Helvetica, Arial, Sans-Serif";
    //if (mouse.mode === 'draw') spriteCtx.fillText("Draw", spriteCanvas.width - sidebar + 10, 300);
    if (mouse.mode === 'draw') document.getElementById('spriteDrawMode').textContent = 'Draw';
    //if (mouse.mode === 'fill') spriteCtx.fillText("Fill", spriteCanvas.width - sidebar + 10, 300);
    if (mouse.mode === 'fill') document.getElementById('spriteDrawMode').textContent = 'Fill';

    for (let y = 0; y < gridSize; y++) {                                                           // draw grid
        for (let x = 0; x < gridSize; x++) {
            if (spriteData[y][x] !== 2) {
                spriteCtx.fillStyle = colors[spriteData[y][x]];                                    // Draw pixels to grid
                spriteCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);

                spriteCtx.fillRect((spriteCanvas.width - sidebar + 10) + x * 2, 10 + y * 2, 2, 2); // Draw small preview in sidebar (same color)
                spriteCtx.beginPath();
                spriteCtx.fillStyle = spriteData[y][x] === 1 ? '#417329' : '#e6ce37';
                spriteCtx.fillRect((spriteCanvas.width - sidebar + 10) + x * 2, 54 + y * 2, 2, 2); // Draw small preview in sidebar (picked color)
            }
            spriteCtx.strokeStyle = '#888';                                                        // Grid line color
            spriteCtx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);              // Draw grid lines
            spriteCtx.beginPath();
        }
    }
    drawButtons();
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

    if (x < gridSize && y < gridSize) {                             // draw data to spriteData array if clicked inside grid
        switch (mouse.button) {
            case 0:
                spriteData[y][x] = currentColor;    // either draw the current color (black or white)
                break;
            case 2:
                spriteData[y][x] = 2;               // or draw transparent black
        }
        drawGrid();
    }
    else {                                          // deal with sidebar / button click
        let offset = spriteCanvas.width - sidebar;
        buttons.forEach(button => {
            if (isInsideButton(offset, mouseX, mouseY, button)) {
                //console.log(`${button.label} clicked!`);

                switch (button.label) {
                    case 'Dark':
                        currentColor = 1;
                        break;
                    case 'Light':
                        currentColor = 0;
                        break;
                    case 'CLR':
                        spriteData = Array(gridSize).fill().map(() => Array(gridSize).fill(2));
                        drawGrid();
                        break;
                    case 'FlipY':
                        spriteData = spriteData
                            .reverse();
                        drawGrid();
                        break;
                    case 'FlipX':
                        for (var i = 0; i < spriteData.length; i++) {
                            spriteData[i].reverse();
                        }
                        drawGrid();
                        break;
                    case 'Copy':
                        //console.log(spriteData.length);
                        //clipboard = spriteData.slice();
                        clipboard = structuredClone(spriteData);
                        //clipboard = spriteData.map(item => item);
                        //console.log(clipboard);
                        //console.log('clipboard length: ' + clipboard.length);
                        //console.log(`copied ${spriteData} to clipboard ${clipboard}`)
                        break;
                    case 'Paste':
                        if (clipboard && clipboard.length) { // Check if clipboard contains data
                            spriteData = structuredClone(clipboard); // Clone the clipboard content
                            drawGrid();
                        } else {
                            console.log("Clipboard is empty. Copy data first.");
                        }
                        break;
                }
            }
        });
        drawButtons();
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

        if (targetColor !== currentColor) floodFill(x, y, targetColor, currentColor);
        mouse.down = false;
    }
    draw(event);
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
            //mouse.ctrl = true;
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
        case 'Escape':
            removeSpriteEvents()
            container.style.display = 'none';
            const imageData = updateSpriteImage(spriteData, gridSize);      // in sprite.js
            addToSpriteSheet(currentSprite, spriteData, imageData);  // in sprite-sheet.js
            addMainEvents();
        default:
            mouse.ctrl = false;
    }
}

function addSpriteEvents() {
    // Add events for sprite editor
    // Event listeners for mouse click
    spriteCanvas.addEventListener('mousedown', handlespriteCanvasClick);
    spriteCanvas.addEventListener('mouseup', () => { mouse.down = false; });
    spriteCanvas.addEventListener('mousemove', handleMouseMove);
    spriteCanvas.addEventListener('mouseleave', () => { mouse.down = false; });
    // Event listener for keyboard
    document.addEventListener('keydown', handleKeyboard);
    document.addEventListener('keyup', handleKeyboard);
}

function removeSpriteEvents() {
    // Add events for sprite editor
    // Event listeners for mouse click
    spriteCanvas.removeEventListener('mousedown', handlespriteCanvasClick);
    spriteCanvas.removeEventListener('mouseup', () => { });
    spriteCanvas.removeEventListener("mousemove", handleMouseMove);
    spriteCanvas.removeEventListener('mouseleave', () => { });
    // Event listener for keyboard
    document.removeEventListener('keydown', handleKeyboard);
    document.removeEventListener('keyup', handleKeyboard);
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
}

export function editSprite(current) {
    //container.hidden = container.hidden === false ? true : false;
    //container.style.display = container.style.display === 'block' ? 'none' : 'block';
    container.style.display = 'block';
    currentSprite = current;

    // add event listeners
    addSpriteEvents();

    // Initial draw
    drawGrid();
}