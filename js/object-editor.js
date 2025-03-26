const container = document.getElementById('editorContainer');
const text = document.getElementById('textEditor');
let textOnly = false;
let tileKey = null;
let objectData = '';
let callbackFunction = () => { };

export function getObjectData(key) {
    //if (objectData[key] === undefined) return null;
    console.log('objectData: ', objectData);
    return objectData;
}

function handleKeyboard(event) {
    switch (event.key) {

        case 'Escape':
            removeObjectEvents();
            container.style.display = 'none';
            addMainEvents();
            objectData = text.value;
            callbackFunction(text.value, tileKey);
            //return text.value;
    }
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
    } else {
        textOnly = false;
    }
    tileKey = key;
    callbackFunction = callback;
    text.value = script;
    container.style.display = 'block';
    addObjectEvents();
}