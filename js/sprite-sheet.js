import { spriteData, updateSpriteData } from './sprite-editor.js';
 
let spriteSheet = [];

export function getSpriteSheet () {
    return spriteSheet;
 }
 
export function addToSpriteSheet(currentSprite, spriteData) {
    spriteSheet[currentSprite] = JSON.parse(JSON.stringify(spriteData)); // Clone spriteData and add to spriteSheet
    console.log("Sprite added to sprite sheet.");
}

 // Save sprite sheet as a JSON file
document.getElementById('saveSpriteSheet').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(spriteSheet)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'spriteSheet.json';
    link.click();
});

// Load sprite sheet from a JSON file
document.getElementById('loadSpriteSheetButton').addEventListener('click', () => {
    document.getElementById('loadSpriteSheet').click();
});

document.getElementById('loadSpriteSheet').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const loadedSpriteSheet = JSON.parse(e.target.result);
            if (Array.isArray(loadedSpriteSheet)) {
                spriteSheet = loadedSpriteSheet; // Update the spriteSheet array
                console.log("Sprite sheet loaded:", spriteSheet);
            } else {
                console.error("Invalid sprite sheet file format.");
            }
        };
        reader.readAsText(file);
    }
});

// Load a specific sprite from the sprite sheet into the grid
document.getElementById('loadSpriteToGrid').addEventListener('click', () => {
    const index = parseInt(document.getElementById('spriteIndex').value);
    if (index >= 0 && index < spriteSheet.length) {
        updateSpriteData(JSON.parse(JSON.stringify(spriteSheet[index]))); // Clone selected sprite
        //drawGrid(); // Update the canvas with the loaded sprite
        console.log("Loaded sprite at index", index, "onto grid.");
    } else {
        console.error("Invalid sprite index.");
    }
});