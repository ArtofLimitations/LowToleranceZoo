import { getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

/*/ Data to save (EXAMPLE) 
const arrayData = [1, 2, 3, 4, 5];
const variableData = "This is some text content.";
const objectData = { name: "John", age: 30, job: "Developer" };
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); */

export function saveSpriteSheet() {
    /* Combine all the data into one Blob
    const allData = {
        array: arrayData,
        text: variableData,
        object: objectData,
        imageData: Array.from(imageData.data), // Convert Uint8ClampedArray to regular array for serialization
    };*/

    const spriteSheet = getSpriteSheet();

    // Convert the data to JSON
    const jsonData = JSON.stringify(spriteSheet, null, 2);

    // Create a Blob from the JSON data
    const blob = new Blob([jsonData], { type: "application/json" });

    // Create a download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "data.json";

    // Append the link to the DOM, click it to start download, and remove it afterward
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export async function loadSpriteSheet(fileInput) {
    try {
        // Get the selected file from the input element
        const file = fileInput.files[0];
        if (!file) {
            throw new Error("No file selected");
        }

        // Read the file as text
        const text = await file.text();

        // Parse the JSON data
        const spriteSheet = JSON.parse(text);

        console.log('Loaded Sprite Sheet:', spriteSheet);

        // Return the parsed data
        return spriteSheet;
    } catch (error) {
        console.error('Error loading sprite sheet:', error);
    }
}

document.getElementById('saveSpriteSheet').addEventListener('click', saveSpriteSheet);

/*const blob = new Blob([JSON.stringify(spriteSheet)], { type: 'application/json' });
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = 'spriteSheet.json';
link.click();
});*/

document.getElementById('loadSpriteSheetButton').addEventListener('click', () => {
    document.getElementById('loadSpriteSheet').click();
});

document.getElementById('loadSpriteSheet').addEventListener('change', (event) => {
    loadSpriteSheet(event.target).then(data => {
        console.log('Sprite sheet array or object:', data);
        replaceSpriteSheet(data);
    });
});
