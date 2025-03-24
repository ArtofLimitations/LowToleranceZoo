const container = document.getElementById('editorContainer');
const text = document.getElementById('textEditor');
let textOnly = false;
let data = null;

export function getObjectData() {
    return data;
}

function handleKeyboard(event) {
    switch (event.key) {

        case 'Escape':
            removeObjectEvents();
            container.style.display = 'none';
            addMainEvents();
            data = text.value;
            return text.value;
    }
}

function addObjectEvents() {
    document.addEventListener('keydown', handleKeyboard);
}

function removeObjectEvents() {
    document.removeEventListener('keydown', handleKeyboard);
}

export function editObject (type) {
    if (type === 'text') {
        textOnly = true;
    } else {
        textOnly = false;
    }
    container.style.display = 'block';
    addObjectEvents();
}