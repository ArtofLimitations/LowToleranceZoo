const container = document.getElementById('editorContainer');
const title = container.querySelector('strong');
const text = document.getElementById('textEditor');
let textOnly = false;
let tileKey = null;
let objectText = '';
let callbackFunction = () => { };

export function getObjectData(key) {
    //if (objectData[key] === undefined) return null;
    console.log('objectData: ', objectText);
    return objectText;
}

function handleKeyboard(event) {
    switch (event.key) {

        case 'Escape':
            let result = sanitizeInput(text.value);
            objectText = result;
            //if (!textOnly) result = parseScriptFromTextarea(result);
            removeObjectEvents();
            addMainEvents();
            container.style.display = 'none';
            callbackFunction(result, tileKey);
    }
}

function sanitizeInput(input) {
    return input.replace(/<(?!\/?(b|i|br|em|strong|center|page)\b)[^>]*>/gi, "");
}

function parseScriptFromTextarea(text) {
    let lines = text.trim().split("\n").map(line => line.trim());
    let script = [];
    let collectingText = false;
    let textBlock = "";

    for (let line of lines) {
        if (line === "#text") {
            collectingText = true;
            textBlock = "";
            continue;
        } 
        
        if (collectingText) {
            if (line === "#end") {
                script.push(`#text ${textBlock.trim()}`); // Store full text block as one entry
                collectingText = false;
            } else {
                textBlock += line + "\n"; // Keep collecting multi-line text
            }
            continue;
        }

        // Store regular commands or section headers
        if (line !== "") {
            script.push(line);
        }
    }

    return script;
}

function addObjectEvents() {
    document.addEventListener('keydown', handleKeyboard);
}

function removeObjectEvents() {
    document.removeEventListener('keydown', handleKeyboard);
}

export function editObject (type, script, key, callback) {
    if (type === 'text') {
        textOnly = true;
        title.innerText = 'Edit Sign Text';
    } else {
        textOnly = false;
        title.innerText = 'Edit Object Script';
    }
    tileKey = key;
    callbackFunction = callback;
    text.value = script;
    container.style.display = 'block';
    addObjectEvents();
    text.focus();
    text.setSelectionRange(text.value.length, text.value.length); // Move cursor to end of text
}