const container = document.getElementById('editorContainer');
const title = container.querySelector('strong');
const text = document.getElementById('textEditor');
let tileKey = null;
let objectText = '';
let callbackFunction = () => { };

export function getObjectData(key) {
    console.log('objectData: ', objectText);
    return objectText;
}

const allowedInlineTags = new Set(['B', 'I', 'EM', 'STRONG', 'CENTER', 'PAGE', 'SPAN']);

// Keep safe inline markup (including future syntax-highlighting spans) and
// turn contenteditable's block structure into explicit, stable line breaks.
function getEditorContent(element) {
    const output = document.createElement('div');

    function copyChildren(source, destination) {
        for (const node of source.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                destination.appendChild(document.createTextNode(node.nodeValue));
                continue;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            const tag = node.tagName;
            if (tag === 'BR') {
                destination.appendChild(document.createElement('br'));
            } else if (tag === 'DIV' || tag === 'P') {
                copyChildren(node, destination);
                destination.appendChild(document.createElement('br'));
            } else if (allowedInlineTags.has(tag)) {
                const cleanElement = document.createElement(tag.toLowerCase());
                if (tag === 'SPAN' && node.classList.length) {
                    cleanElement.className = Array.from(node.classList)
                        .filter(name => /^[a-z0-9_-]+$/i.test(name))
                        .join(' ');
                }
                copyChildren(node, cleanElement);
                destination.appendChild(cleanElement);
            } else {
                // Ignore unsupported elements/attributes but keep their text.
                copyChildren(node, destination);
            }
        }
    }

    copyChildren(element, output);
    return output.innerHTML.replace(/(?:<br>){2,}$/i, '<br>');
}

function closeEditor() {
    const result = getEditorContent(text);
    objectText = result;
    removeObjectEvents();
    addMainEvents();
    container.style.display = 'none';
    callbackFunction(result, tileKey);
}

function handleKeyboard(event) {
    if (event.key === 'Escape') closeEditor();
}

function addObjectEvents() {
    document.addEventListener('keydown', handleKeyboard);
    document.getElementById('editorContainerClose').addEventListener('click', closeEditor);
}

function removeObjectEvents() {
    document.removeEventListener('keydown', handleKeyboard);
    document.getElementById('editorContainerClose').removeEventListener('click', closeEditor);
}

export function editObject(type, script, key, callback) {
    title.innerText = type === 'text' ? 'Edit Sign Text' : 'Edit Object Script';
    tileKey = key;
    callbackFunction = callback;
    text.innerHTML = script || '';
    container.style.display = 'block';
    addObjectEvents();
    text.focus();
}
