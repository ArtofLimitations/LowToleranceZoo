import { getSpriteSheet, replaceSpriteSheet, rebuildSpriteSheet } from './sprite-sheet.js';
import { convertToImageData } from './sprite.js';
import { packLtz, openLtzDialog, downloadBytes, getAudioStore, clearAudioStore } from './ltz.js';
const canvas = document.getElementById('lowToleranceCanvas');
const ctx = canvas.getContext('2d');

// ################ Save Functions

export function saveSpriteSheet() { // Save Sprite Sheet only to JSON 

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

export function saveCombinedData(spritesheet, board, fileName = 'gameData') { // Save Combined Game Data (Board, SpriteSheet)
    let dataToSave = spritesheet.map(element => element[0]);
    const fileExtension = 'json';
    const combinedData = {
        spritesheet: dataToSave,
        board: board
    };

    // Create a Blob from the JSON data
    const jsonData = JSON.stringify(combinedData);
    const blob = new Blob([jsonData], { type: 'application/json' });

    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.${fileExtension}`;

    // Append the link to the DOM, click it to start download, and remove it afterward
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function saveWorld(spritesheet, boardList, world, worldSettings = {}, boardSettings = {}, filename = 'world') {
    const fileExtension = 'json';
    let worldData = {
        spritesheet: spritesheet.map(element => element[0]),
        boards: boardList,
        world: world,
        worldSettings: worldSettings,
        boardSettings: boardSettings
    };

    // Convert the data to JSON
    const jsonData = JSON.stringify(worldData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });

    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.${fileExtension}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ################ LTZ Save / Load

export async function saveLtz(spritesheet, boardList, world, worldSettings = {}, boardSettings = {}, filename = 'world') {
    const worldData = {
        spritesheet: spritesheet.map(element => element[0]),
        boards: boardList,
        world: world,
        worldSettings: worldSettings,
        boardSettings: boardSettings
    };
    const bytes = packLtz(worldData, filename);
    const suggestedName = (worldSettings.filename || filename || 'world').replace(/\.ltz$/i, '') + '.ltz';

    // Use the File System Access API when available (Chrome/Edge)
    // This opens a real OS Save dialog with the filename pre-filled.
    if (window.showSaveFilePicker) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName,
                types: [{
                    description: 'Low Tolerance Zoo project',
                    accept: { 'application/octet-stream': ['.ltz'] }
                }]
            });
            const writable = await fileHandle.createWritable();
            await writable.write(bytes);
            await writable.close();
            console.log(`Saved: ${fileHandle.name}`);
        } catch (err) {
            // User cancelled the dialog — not an error
            if (err.name !== 'AbortError') {
                console.error('Save failed:', err);
                alert('Save failed: ' + err.message);
            }
        }
    } else {
        // Fallback for Firefox: trigger a download with the suggested name
        downloadBytes(bytes, suggestedName);
    }
}

export function loadLtz(callback) {
    openLtzDialog()
        .then(({ worldData, isLegacy }) => {
            if (isLegacy) {
                console.log('Loaded legacy .json world file — save as .ltz with F1 to convert.');
            }
            let spritesheet = rebuildSpriteSheet(worldData.spritesheet);
            const boardList     = worldData.boards         || {};
            const world         = worldData.world          || {};
            const worldSettings = worldData.worldSettings  || {};
            const boardSettings = worldData.boardSettings  || {};
            if (typeof callback === 'function') {
                callback(spritesheet, boardList, world, worldSettings, boardSettings);
            }
        })
        .catch(err => {
            console.error('Error loading file:', err);
            alert('Could not load file: ' + err.message);
        });
}

// ################ Load Functions

export async function loadSpriteSheet(fileInput) { // Load Sprite Sheet
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

export function loadSpriteSheetDialog(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Use your existing loader logic
                const spriteSheet = await loadSpriteSheet({ files: [file] });
                if (callback && typeof callback === 'function') {
                    callback(spriteSheet);
                }
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Invalid JSON file. Please upload a valid spritesheet file.');
            }
        };
        reader.readAsText(file);
    });

    input.click();
}

export function loadCombinedData(callback) { // Load Combined Game Data (Board, SpriteSheet)
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
                const combinedData = JSON.parse(e.target.result);
                let spritesheet = combinedData.spritesheet;
                const board = combinedData.board;

                spritesheet = rebuildSpriteSheet(spritesheet);

                // Pass the data to the provided callback function
                if (callback && typeof callback === 'function') {
                    callback(spritesheet, board);
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

export function loadWorld(callback) {
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
                console.log('Loaded file:', file.name);
                // Parse the JSON data
                const combinedData = JSON.parse(e.target.result);
                let spritesheet = combinedData.spritesheet;
                const boardList = combinedData.boards;
                const world = combinedData.world;
                const worldSettings = combinedData.worldSettings || {};
                const boardSettings = combinedData.boardSettings || {};

                spritesheet = rebuildSpriteSheet(spritesheet);

                // Pass the data to the provided callback function
                if (callback && typeof callback === 'function') {
                    callback(spritesheet, boardList, world, worldSettings, boardSettings);
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


//saveCombinedData(spritesheet, board, 'gameData');

/*/ Buttons for testing
document.getElementById('saveSpriteSheet').addEventListener('click', saveSpriteSheet);

document.getElementById('loadSpriteSheetButton').addEventListener('click', () => {
    document.getElementById('loadSpriteSheet').click();
});

document.getElementById('loadSpriteSheet').addEventListener('change', (event) => {
    loadSpriteSheet(event.target).then(data => {
        console.log('Sprite sheet array or object:', data);
        replaceSpriteSheet(data);
    });
});
*/