import { getSpriteSheet, replaceSpriteSheet } from './sprite-sheet.js';
import { convertToImageData } from './sprite.js';
const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

/*/ Data to save (EXAMPLE) 
const arrayData = [1, 2, 3, 4, 5];
const variableData = "This is some text content.";
const objectData = { name: "John", age: 30, job: "Developer" };
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); */

//Combine all the data into one Blob
//const allData = {
//array: arrayData,
//text: variableData,
//object: objectData,
//imageData: Array.from(imageData.data), // Convert Uint8ClampedArray to regular array for serialization
//};

// ################ Save Functions

export function saveSpriteSheet() {

    const spriteSheet = getSpriteSheet();
    let dataToSave = spriteSheet.map(element => element[0]);

    // Convert the data to JSON
    const jsonData = JSON.stringify(dataToSave, null, 2);

    // Create a Blob from the JSON data
    const blob = new Blob([jsonData], { type: 'application/json' });

    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'spritesheet.json';

    // Append the link to the DOM, click it to start download, and remove it afterward
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function saveBoard(data, fileName = 'board') {
    const fileExtension = 'json';
    let dataToSave = {};
    //console.log(data, Array.isArray(data));

    // Iterate over object keys and values
    Object.entries(data).forEach(([key, value]) => {
        dataToSave[key] = value; // Copy key-value pairs directly
    });

    // Convert the data to JSON
    const jsonData = JSON.stringify(dataToSave, null, 2);

    // Create a Blob from the JSON data
    const blob = new Blob([jsonData], { type: 'application/json' });

    // Create a download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.${fileExtension}`;

    // Append the link to the DOM, click it to start download, and remove it afterward
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ################ Load Functions

export async function loadSpriteSheet(fileInput) {
    try {
        // Get the selected file from the input element
        const file = fileInput.files[0];
        if (!file) {
            throw new Error('No file selected');
        }

        // Read the file as text
        const text = await file.text();

        // Parse the JSON data
        const dataToLoad = JSON.parse(text);

        /*/ litte test to see if arrays are 16 in length 
        const test = dataToLoad.every((element) => element.length === 16);
        if (!test) {
            alert('The data loaded is wrong size');
            return;
        }*/

        console.log('Loaded Sprite Sheet:', dataToLoad);

        let spriteSheet = [0];
        spriteSheet.splice(1, 0, ...dataToLoad.slice(1).map(element => [element, convertToImageData(element, [0, 0, 0, 255], [255, 255, 255, 255])]));
        //const spriteSheet = dataToLoad.slice(1).map(element => [element, convertToImageData(element, [0, 0, 0, 255], [255, 255, 255, 255])]);

        // Return the parsed data
        return spriteSheet;
    } catch (error) {
        console.error('Error loading sprite sheet:', error);
    }
}

export function loadBoard(callback) {
    // Create an input element for file selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    // Trigger the file picker
    input.addEventListener('change', (event) => {
        const file = event.target.files[0]; // Get the selected file
        if (!file) return;

        const reader = new FileReader();

        // Read the file contents
        reader.onload = (e) => {
            try {
                // Parse the JSON data
                const jsonData = JSON.parse(e.target.result);
                console.log('Loaded Data:', jsonData);

                // Pass the data to the provided callback function
                if (callback && typeof callback === 'function') {
                    callback(jsonData);
                }
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Invalid JSON file. Please upload a valid board file.');
            }
        };

        reader.readAsText(file); // Read the file as text
    });

    // Simulate a click to open the file dialog
    input.click();
}

document.getElementById('saveSpriteSheet').addEventListener('click', saveSpriteSheet);

document.getElementById('saveBoard').addEventListener('click', saveBoard);
//document.getElementById('saveSpriteSheet').addEventListener('click', saveFile(getSpriteSheet(), "spritesheet", "txt"));

document.getElementById('loadSpriteSheetButton').addEventListener('click', () => {
    document.getElementById('loadSpriteSheet').click();
});

document.getElementById('loadSpriteSheet').addEventListener('change', (event) => {
    loadSpriteSheet(event.target).then(data => {
        console.log('Sprite sheet array or object:', data);
        replaceSpriteSheet(data);
    });
});
