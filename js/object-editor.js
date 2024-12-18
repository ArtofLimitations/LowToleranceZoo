const container = document.getElementById('editorContainer');

function handleKeyboard(event) {
    switch (event.key) {

        case 'Escape':
            removeObjectEvents();
            container.style.display = 'none';
            addMainEvents();
            break;
    }
}

function addObjectEvents() {
    document.addEventListener('keydown', handleKeyboard);
}

function removeObjectEvents() {
    document.removeEventListener('keydown', handleKeyboard);
}

export function editObject () {
    container.style.display = 'block';
    addObjectEvents();
}