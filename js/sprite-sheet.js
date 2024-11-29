import { spriteData, updateSpriteData } from './sprite-editor.js';
 
let spriteSheet = [];

export function getSpriteSheet () {
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
    //console.log ('replaced sprite sheet with: '+data);
    /*let arrayData = data;
    arrayData.forEach(element => {
        arrayData[element][1] = new ImageData(arrayData[element][1], 32, 32);
    });*/
    spriteSheet = structuredClone(data);
}