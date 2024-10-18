// In sprites.js
//console.log('Function called from sprite.js');

const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

// For the exported sprite canvas
const exportedCanvas = document.getElementById('exportedSpriteCanvas');
const exportedCtx = exportedCanvas.getContext('2d');

//let spriteImage = new Image();
//spriteImage.src = '../assets/log.png'; // Path to your sprite image for testing
let imageData = 0;
let gridSize = 0;

// Draw the sprite in the center of a specific tile
export function drawSprite(x, y, tileSizeX, tileSizeY) {
    //const posX = x * tileSizeX + (tileSizeX / 2) - (spriteImage.width / 2);
    //const posY = y * tileSizeY + (tileSizeY / 2) - (spriteImage.height / 2);
    //ctx.drawImage(spriteImage, posX, posY);
    ctx.putImageData(imageData, x * tileSizeX, y * tileSizeY);
}

export function updateSpriteImage(data, size) {
    console.log('updated spriteImage');
    gridSize = size;
    //imageData = spriteDataToImage(data);
    imageData = convertToImageData(data);
}

function spriteDataToImage(spriteData) {
    //const spriteData = spriteData;
    const imageData = exportedCtx.createImageData(gridSize, gridSize);
    exportedCtx.scale(2, 2);
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const color = spriteData[y][x] === 1 ? 0 : 255; // black (0) or white (255)
            const index = (y * gridSize + x) * 4; // Each pixel has 4 values (RGBA)
            imageData.data[index] = color;        // R
            imageData.data[index + 1] = color;    // G
            imageData.data[index + 2] = color;    // B
            imageData.data[index + 3] = 255;      // A (opacity)
        }
    }
    return imageData;
}

 // Function to convert spriteData to ImageData and scale it up
 function convertToImageData(spriteData) {
    const imgData = exportedCtx.createImageData(32, 32); // Create a 32x32 ImageData object

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            //const color = spriteData[y][x] === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]; // White or Black RGBA
            let color = [0, 0, 0, 0];
            switch (spriteData[y][x]) {
                case 0:
                    color = [255, 255, 255, 255];
                break;
                case 1:
                    color = [0, 0, 0, 255];
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