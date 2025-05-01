//import { spriteData, updateSpriteData } from './sprite-editor.js';
import { convertToImageData } from './sprite.js';

let spriteSheet = [];

export function getSpriteSheet() {
    return spriteSheet;
}

export function addToSpriteSheet(currentSprite, spriteData, imageData) {
    spriteSheet[currentSprite] = [spriteData, imageData]; // Clone spriteData and add to spriteSheet
    console.log("Sprite added to sprite sheet.");
}

export function getImageFromSheet(index) {
    //const obj = JSON.parse(JSON.stringify(spriteSheet[index][1]))
    if (spriteSheet[index] !== undefined) {
        return spriteSheet[index][1]; // was 1
    }
    else {
        console.error(`Sprite index ${index} is undefined in spriteSheet.`);
        return undefined;
    }
    //console.log('sprite sheet at index: ' + spriteSheet[index][1]);
    //const array = Object.values(obj);
}

export function getDataFromSheet(index) {
    if (spriteSheet[index] !== undefined) {
        return spriteSheet[index][0];
    }
    else {
        console.log(`No sprite at ${index} in array`);
        return undefined;
    }
}

export function replaceSpriteSheet(data) {
    spriteSheet = structuredClone(data);
}

/*export function rebuildSpriteSheet(data) {
    let spriteSheet = [0];
    spriteSheet.splice(1, 0, ...data.slice(1).map(element => [element, convertToImageData(element, [0, 0, 0, 255], [255, 255, 255, 255])]));
    return spriteSheet;
}*/

export function rebuildSpriteSheet(data, gridSize = 16) {
    let spriteSheet = [0]; // Initialize with a placeholder for index 0

    spriteSheet.splice(
        1,
        0,
        ...data.slice(1).map(element => {
            // Replace null values with a default grid
            if (element === null) {
                console.warn('Null value found in sprite sheet. Replacing with default grid.');
                element = Array(gridSize).fill().map(() => Array(gridSize).fill(2));
            }

            // Convert the element to image data
            return [element, convertToImageData(element, [0, 0, 0, 255], [255, 255, 255, 255])];
        })
    );

    return spriteSheet;
}