// In sprites.js

const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

const spriteImage = new Image();
console.log('Function called from sprite.js');
spriteImage.src = '../assets/log.png'; // Path to your sprite image

// Draw the sprite in the center of a specific tile
export function drawSprite(x, y, tileSizeX, tileSizeY) {
    const posX = x * tileSizeX + (tileSizeX / 2) - (spriteImage.width / 2);
    const posY = y * tileSizeY + (tileSizeY / 2) - (spriteImage.height / 2);
    ctx.drawImage(spriteImage, posX, posY);
}