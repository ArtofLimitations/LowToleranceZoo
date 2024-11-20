import { getImageFromSheet, getDataFromSheet } from './sprite-sheet.js';

const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');
const exportedCanvas = document.getElementById('exportedSpriteCanvas');
const exportedCtx = exportedCanvas.getContext('2d');

export let imageData = 0;
let gridSize = 16;
let spriteData = Array(gridSize).fill().map(() => Array(gridSize).fill(2));
let currentSprite = 1;

export function drawSprite(x, y, tileSizeX, tileSizeY, spriteNumber, colors) {
    //const image = getImageFromSheet(spriteNumber) ?? convertToImageData(Array(gridSize).fill().map(() => Array(gridSize).fill(2)));
    const data = getDataFromSheet(spriteNumber) ?? convertToImageData(Array(gridSize).fill().map(() => Array(gridSize).fill(2)));
    const dark = colors[0];
    const light = colors[1];
    //console.log(colors);
    const image = convertToImageData(data, dark, light)
    ctx.putImageData(image, x * tileSizeX, y * tileSizeY);
}

export function updateSpriteImage(data, size, current, light = [255, 255, 255, 255], dark = [0, 0, 0, 255]) {
    console.log('updated spriteImage');
    //console.log(data);
    spriteData = data;
    gridSize = size;
    currentSprite = current;
    imageData = convertToImageData(data, dark, light);
    return imageData;
}

function convertToImageData(spriteData, dark, light) {
    const imgData = exportedCtx.createImageData(32, 32);

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            //const color = spriteData[y][x] === 0 ? light : spriteData[y][x] === 1 ? dark : [0, 0, 0, 0];
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
            setPixel(imgData, x * 2, y * 2, color);
            setPixel(imgData, x * 2 + 1, y * 2, color);
            setPixel(imgData, x * 2, y * 2 + 1, color);
            setPixel(imgData, x * 2 + 1, y * 2 + 1, color);
        }
    }
    return imgData;
}

function setPixel(imageData, x, y, [r, g, b, a]) {
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a * 255;
}
