// In sprites.js
import { getImageFromSheet } from './sprite-sheet.js';

const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

// For the exported sprite canvas
const exportedCanvas = document.getElementById('exportedSpriteCanvas');
const exportedCtx = exportedCanvas.getContext('2d');

//let spriteImage = new Image();
//spriteImage.src = '../assets/log.png'; // Path to your sprite image for testing
//export let spriteSheet = [];
export let imageData = 0;
let gridSize = 16;
let spriteData = Array(gridSize).fill().map(() => Array(gridSize).fill(2)); // 16x16 grid, initially all alpha (2)
let currentSprite = 1;

// Draw the sprite in the center of a specific tile
export function drawSprite(x, y, tileSizeX, tileSizeY, spriteNumber) {
    //const posX = x * tileSizeX + (tileSizeX / 2) - (spriteImage.width / 2); 
    //const posY = y * tileSizeY + (tileSizeY / 2) - (spriteImage.height / 2);
    //ctx.drawImage(spriteImage, posX, posY);
    let image = undefined;
    if (getImageFromSheet(spriteNumber) !== undefined) {
        image = getImageFromSheet(spriteNumber);
    }
    else {
        image = convertToImageData(Array(gridSize).fill().map(() => Array(gridSize).fill(2)));
    }
    //console.log('what r we now: '+image);
    ctx.putImageData(image, x * tileSizeX, y * tileSizeY);
    //ctx.putImageData(imageData, x * tileSizeX, y * tileSizeY);
}

export function updateSpriteImage(data, size, current, light = [255, 255, 255, 255], dark = [0, 0, 0, 255]) {
    console.log('updated spriteImage');
    console.log(data);
    spriteData = data;

    gridSize = size;
    currentSprite = current;

    imageData = convertToImageData(data, dark, light);
    console.log('array is: ' + imageData);

    return imageData;
}

export function updateSpriteColor(dark, light) {
    //const colorDark = rgbStringToArray(dark);
    //const colorLight = rgbStringToArray(light);
    imageData = convertToImageData(spriteData, dark, light);
    return imageData;
}

function rgbStringToArray(rgbString) {
    // Use a regular expression to extract the numerical values
    const matches = rgbString.match(/\d+/g);
  
    // Convert the string values to numbers
    return matches.map(Number);
  }

 // Function to convert spriteData to ImageData and scale it up
 function convertToImageData(spriteData, dark, light) {
    const imgData = exportedCtx.createImageData(32, 32); // Create a 32x32 ImageData object

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            //const color = spriteData[y][x] === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]; // White or Black RGBA
            let color = [0, 0, 0, 0];
            switch (spriteData[y][x]) {
                case 0:
                    color = light;
                break;
                case 1:
                    color = dark;
                break;
                case 2:
                    color = [0, 0, 0, 0];
            }
            // Set 4 pixels (2x2) to scale up the sprite by 2x
            setPixel(imgData, x * 2, y * 2, color);
            setPixel(imgData, x * 2 + 1, y * 2, color);
            setPixel(imgData, x * 2, y * 2 + 1, color);
            setPixel(imgData, x * 2 + 1, y * 2 + 1, color);
        }
    }

    //previewCtx.putImageData(imgData, 0, 0); // Draw the scaled-up ImageData on the preview canvas
    return imgData;
}

// Helper function to set a pixel in the ImageData object
function setPixel(imageData, x, y, [r, g, b, a]) {
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a;
}