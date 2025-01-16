import { getImageFromSheet, getDataFromSheet } from './sprite-sheet.js';

const canvas = document.getElementById('lowToleranceCanvas');
const ctx = canvas.getContext('2d');
const exportedCanvas = document.getElementById('exportedSpriteCanvas');
const exportedCtx = exportedCanvas.getContext('2d');

let imageData = 0;
let gridSize = 16;
let spriteData = Array(gridSize).fill().map(() => Array(gridSize).fill(2));
let currentSprite = 1;

export function drawSprite(x, y, tileSizeX, tileSizeY, spriteNumber, colors) {
    //const image = getImageFromSheet(spriteNumber) ?? convertToImageData(Array(gridSize).fill().map(() => Array(gridSize).fill(2)));
    const data = getDataFromSheet(spriteNumber) ?? Array(gridSize).fill().map(() => Array(gridSize).fill(2));
    /*let data = [];
    if (getDataFromSheet(spriteNumber)) {
        data = getDataFromSheet(spriteNumber)
    } else { data = Array(gridSize).fill().map(() => Array(gridSize).fill(2)); }*/
    const dark = colors[0];
    const light = colors[1];
    //console.log(colors);
    const image = convertToImageData(data, dark, light);
    exportedCtx.putImageData(image, 0, 0);
    //ctx.save();
    //ctx.globalCompositeOperation = 'source-over';
    //ctx.putImageData(image, x * tileSizeX, y * tileSizeY);
    //ctx.filter = "blur(1px)";
    ctx.drawImage(exportedCanvas, x * tileSizeX, y * tileSizeY, 32, 32);
    //ctx.restore();
}

export function drawSpriteImage(x, y, tileSizeX, tileSizeY, image) {
    const imageData = new ImageData(image, 32, 32);
    exportedCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(exportedCanvas, x * tileSizeX, y * tileSizeY, 32, 32);
}

export function drawDataURL(x, y, tileSizeX, tileSizeY, dataURL) {
    const img = new Image();
    img.onload = () =>  ctx.drawImage(img, x * tileSizeX, y * tileSizeY, 32, 32);
    img.src = dataURL;
}

export function createDataURL (data, dark, light) {
    const image = convertToImageData(data ?? Array(gridSize).fill().map(() => Array(gridSize).fill(2)), dark, light)
    exportedCtx.putImageData(image, 0, 0);
    const dataURL = exportedCanvas.toDataURL('image/png'); // Convert the canvas to a Data URL
    return dataURL
}

export function updateSpriteImage(data, current, light = [255, 255, 255, 255], dark = [0, 0, 0, 255]) {
    console.log('updated spriteImage');
    //console.log(data);
    spriteData = data;
    currentSprite = current;
    imageData = convertToImageData(data, dark, light);
    return imageData;
}

export function convertToImageData(spriteData, dark, light) {
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

    //return createImageBitmap(imgData.data);
    return imgData;
}

function setPixel(imageData, x, y, [r, g, b, a]) {
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a * 255;
}

function adjustColor(rgba, factor) {
    const [r, g, b, a] = rgba; // Decompose RGBA array
    const lighten = factor > 0;

    const adjust = (channel) => {
        if (lighten) {
            return Math.min(255, channel + (255 - channel) * factor);
        } else {
            return Math.max(0, channel - channel * -factor);
        }
    };

    return [
        adjust(r),
        adjust(g),
        adjust(b),
        a // Alpha remains unchanged
    ];
}

// Usage example:
//const rgba = [100, 150, 200, 0.8]; // RGBa input
//const lightened = adjustColor(rgba, 0.2); // Lighten by 20%
//const darkened = adjustColor(rgba, -0.3); // Darken by 30%
