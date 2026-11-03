import { EditorView, basicSetup } from 'https://esm.sh/codemirror';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from 'https://esm.sh/@codemirror/language';
import { Decoration, ViewPlugin, WidgetType } from 'https://esm.sh/@codemirror/view';
import { tags } from 'https://esm.sh/@lezer/highlight';
import Picker from './modules/vanilla-picker.js';

const container = document.getElementById('editorContainer');
const title = container.querySelector('strong');
const editorHost = document.getElementById('codeEditor');
let tileKey = null;
let objectText = '';
let callbackFunction = () => { };
let editorView = null;
let editingSignText = false;
let colorPicker = null;
let colorPickerAnchor = null;
let activeColorRange = null;
let colorPickerEscapeListenerAdded = false;

export function getObjectData(key) {
    console.log('objectData: ', objectText);
    return objectText;
}

const allowedInlineTags = new Set(['B', 'I', 'EM', 'STRONG', 'CENTER', 'PAGE', 'SPAN']);

const hexColorPattern = /#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi;

const scriptLanguage = StreamLanguage.define({
    startState() {
        return { mixinNamePending: false };
    },
    token(stream, state) {
        if (stream.sol()) {
            state.mixinNamePending = false;
            if (stream.match(/^\s*--.*/)) return 'comment';
            if (stream.match(/^\s*@mixin\b/i)) {
                state.mixinNamePending = true;
                return 'keyword';
            }
            if (stream.match(/^\s*@endmixin\b/i)) return 'keyword';
            if (stream.match(/^\s*@[^\s].*/)) return 'labelName';
            if (stream.match(/^\s*:[^\s]*/)) return 'labelName';
            if (stream.match(/^\s*#\S+/)) return 'keyword';
        }

        if (stream.eatSpace()) return null;

        if (state.mixinNamePending) {
            state.mixinNamePending = false;
            stream.skipToEnd();
            return 'labelName';
        }

        if (stream.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/i)) return 'atom';
        if (stream.match(/@[^\s]+/)) return 'labelName';
        if (stream.match(/:[A-Za-z_][\w.-]*/)) return 'labelName';
        if (stream.match(/\$[A-Za-z_][\w.-]*/)) return 'variableName';
        if (stream.match(/\d+(?:\.\d+)?/)) return 'number';
        if (stream.match(/[+\-*/=<>!]+/)) return 'operator';

        stream.next();
        return null;
    }
});

const editorTheme = EditorView.theme({
    '&': {
        width: '100%',
        height: '540px',
        backgroundColor: '#131313',
        color: '#ffc800'
    },
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: "'Courier New', Courier, monospace"
    },
    '.cm-content': {
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        caretColor: '#ffc800'
    },
    '.cm-gutters': {
        backgroundColor: '#1b1b1b',
        color: '#888',
        borderRight: '1px solid #333'
    },
    '&.cm-focused': {
        outline: '1px solid #111'
    },
    '.cm-activeLine': {
        backgroundColor: '#41414173'
    },
    '.cm-cursor, .cm-dropCursor': {
        borderLeft: '1px solid #ffc800'
    },
    '.cm-color-swatch': {
        display: 'inline-block',
        width: '0.8em',
        height: '0.8em',
        marginLeft: '0.35em',
        padding: '0',
        border: '1px solid #aaa',
        borderRadius: '2px',
        verticalAlign: 'middle',
        cursor: 'pointer'
    },

    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: '#2f3d64' },
});

/*'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: '#514800'
    },*/

const scriptHighlightStyle = syntaxHighlighting(HighlightStyle.define([
    { tag: tags.comment, color: '#888888' },
    { tag: tags.keyword, color: '#9fd3bb' },
    { tag: tags.atom, color: '#e4a86b' },
    { tag: tags.labelName, color: '#d8a0df' },
    { tag: tags.variableName, color: '#76d6c9' },
    { tag: tags.number, color: '#91b7f4' },
    { tag: tags.operator, color: '#e4c07a' }
]));

function replaceColorValue(hex) {
    if (!editorView || !activeColorRange) return;

    const { from, to, original } = activeColorRange;
    if (editorView.state.doc.sliceString(from, to) !== original) return;

    editorView.dispatch({
        changes: { from, to, insert: hex.slice(0, 7) },
        selection: { anchor: from + Math.min(hex.length, 7) }
    });
    editorView.focus();
    activeColorRange = null;
}

function createColorPicker() {
    if (colorPicker) return;

    colorPickerAnchor = document.createElement('span');
    colorPickerAnchor.style.position = 'fixed';
    colorPickerAnchor.style.width = '1px';
    colorPickerAnchor.style.height = '1px';
    colorPickerAnchor.style.zIndex = '20';
    colorPickerAnchor.style.pointerEvents = 'none';
    document.body.appendChild(colorPickerAnchor);

    colorPicker = new Picker({
        parent: colorPickerAnchor,
        popup: 'right',
        alpha: false,
        cancelButton: true,
        color: '#ffffff',
        onDone(color) {
            if (activeColorRange) replaceColorValue(color.hex);
        },
        onClose() {
            const closingRange = activeColorRange;
            setTimeout(() => {
                if (activeColorRange === closingRange) activeColorRange = null;
            }, 0);
        }
    });
}

function openColorPicker(view, from, to, hex, swatch) {
    createColorPicker();
    const rect = swatch.getBoundingClientRect();
    const pickerWidth = 300;
    colorPickerAnchor.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - pickerWidth))}px`;
    colorPickerAnchor.style.top = `${Math.max(0, Math.min(rect.top, window.innerHeight - 300))}px`;
    colorPicker.setOptions({
        popup: rect.left + pickerWidth > window.innerWidth ? 'left' : 'right'
    });
    activeColorRange = { from, to, original: hex };
    colorPicker.setColor(hex, true);
    colorPicker.show();
    if (!colorPickerEscapeListenerAdded) {
        colorPicker.domElement.addEventListener('keydown', event => {
            if (event.key === 'Escape') event.stopPropagation();
        }, true);
        colorPickerEscapeListenerAdded = true;
    }
}

class ColorSwatchWidget extends WidgetType {
    constructor(hex, from, to) {
        super();
        this.hex = hex;
        this.from = from;
        this.to = to;
    }

    eq(other) {
        return this.hex === other.hex && this.from === other.from && this.to === other.to;
    }

    toDOM(view) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'cm-color-swatch';
        swatch.setAttribute('aria-label', `Choose color ${this.hex}`);
        swatch.title = `Choose color ${this.hex}`;
        swatch.style.backgroundColor = this.hex;
        swatch.addEventListener('mousedown', event => event.preventDefault());
        swatch.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openColorPicker(view, this.from, this.to, this.hex, swatch);
        });
        return swatch;
    }
}

const colorSwatches = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.buildDecorations(view);
    }

    update(update) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    buildDecorations(view) {
        const decorations = [];

        for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
            const line = view.state.doc.line(lineNumber);
            if (/^\s*--/.test(line.text)) continue;

            hexColorPattern.lastIndex = 0;
            let match;
            while ((match = hexColorPattern.exec(line.text)) !== null) {
                const indentLength = line.text.match(/^\s*/)[0].length;
                if (match.index === indentLength && line.text[indentLength] === '#') continue;

                const from = line.from + match.index;
                const to = from + match[0].length;
                decorations.push(Decoration.widget({
                    widget: new ColorSwatchWidget(match[0], from, to),
                    side: 1
                }).range(to));
            }
        }

        return Decoration.set(decorations);
    }
}, {
    decorations: plugin => plugin.decorations
});

const editorExtensions = [
    basicSetup,
    EditorView.lineWrapping,
    scriptLanguage,
    editorTheme,
    scriptHighlightStyle,
    colorSwatches
];

function createEditor() {
    if (editorView) return;

    editorView = new EditorView({
        doc: '',
        extensions: editorExtensions,
        parent: editorHost
    });
}

function getEditorContent(source) {
    const output = document.createElement('div');
    output.innerHTML = source;

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

    const cleanOutput = document.createElement('div');
    copyChildren(output, cleanOutput);
    return cleanOutput.innerHTML.replace(/(?:<br>){2,}$/i, '<br>');
}

function closeEditor() {
    const source = editorView.state.doc.toString();
    const result = editingSignText ? getEditorContent(source) : source;
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
    editingSignText = type === 'text';
    createEditor();
    editorView.dispatch({
        changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: script || ''
        }
    });
    container.style.display = 'block';
    addObjectEvents();
    editorView.focus();
}
