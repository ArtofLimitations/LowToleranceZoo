import Picker from './modules/vanilla-picker.js';
//import { updateSpriteColor } from './sprite.js';

const container = document.getElementById('paletteContainer');
const overlay = document.getElementById('overlay');

const recentLength = 5;
let dark = [0, 0, 0, 1];
let light = [255, 255, 255, 1];
let colorDark = document.getElementById('colorDark');
let colorLight = document.getElementById('colorLight');
let recentColors = [];
let pickerDark = new Picker({ parent: colorDark, alpha: false, color: dark });
let pickerLight = new Picker({ parent: colorLight, alpha: false, color: light });
const presetSelect = document.getElementById('presetPaletteSelect');
const presetImage = document.getElementById('presetPaletteImage');
const presetStatus = document.getElementById('presetPaletteStatus');
let eyeDropperActive = false;

export const PALETTE_RGBA = {
    // --- REDS & BROWNS ---
    dosRed:      "rgba(170, 0, 0, 1)",         // DOS 4: Low Red
    dosLightRed: "rgba(255, 85, 85, 1)",       // DOS 12: Light Red
    dosBrown:    "rgba(170, 85, 0, 1)",           // DOS 6: True DOS Brown / Dark Yellow

    // --- ORANGES & YELLOWS ---
    dosYellow:     "rgba(255, 255, 85, 1)",        // DOS 14: Light Yellow

    // --- GREENS ---
    dosLightGreen:     "rgba(85, 255, 85, 1)",      // DOS 10: Light Green
    dosGreen:          "rgba(0, 170, 0, 1)",        // DOS 2: Low Green

    // --- CYANS & TEALS ---
    dosCyan:          "rgba(0, 170, 170, 1)",           // DOS 3: Low Cyan
    dosLightCyan:     "rgba(85, 255, 255, 1)",     // DOS 11: Light Cyan

    // --- BLUES ---
    dosBlue:        "rgba(0, 0, 170, 1)",             // DOS 1: Low Blue
    dosLightBlue:   "rgba(85, 85, 255, 1)",      // DOS 9: Light Blue

    // --- PURPLES & MAGENTAS ---
    dosMagenta:      "rgba(170, 0, 170, 1)",        // DOS 5: Low Magenta
    dosLightMagenta: "rgba(255, 85, 255, 1)",  // DOS 13: Light Magenta

    // --- GRAYS & NEUTRALS ---
    black:          "rgba(0, 0, 0, 1)",           // DOS 0: Black
    dosDarkGray:    "rgba(85, 85, 85, 1)",        // DOS 8: Dark Gray
    dosLightGray:   "rgba(170, 170, 170, 1)",     // DOS 7: Light Gray

    // --- WHITES & OFF-WHITES ---
    white:        "rgba(255, 255, 255, 1)"            // DOS 15: Bright White
};

export let currentColors = [[0, 0, 0, 1], [255, 255, 255, 1]];

async function loadPresetImages() {
    try {
        const manifestUrl = new URL('../assets/presets/index.json', import.meta.url);
        const response = await fetch(manifestUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to load preset image list: ${response.status} ${response.statusText}`);
        }

        const files = await response.json();
        if (!Array.isArray(files)) {
            throw new Error('Preset image list must be a JSON array.');
        }

        presetSelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = files.length ? 'Select an image...' : 'No preset images found';
        presetSelect.appendChild(placeholder);

        for (const file of files) {
            if (typeof file !== 'string' || !/^[\w.-]+\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file) || file.includes('..')) {
                console.warn('Skipping invalid preset image entry:', file);
                continue;
            }

            const option = document.createElement('option');
            option.value = file;
            option.textContent = file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
            presetSelect.appendChild(option);
        }

        presetSelect.addEventListener('change', () => {
            const file = presetSelect.value;
            presetImage.hidden = !file;
            presetImage.alt = file ? `Color preset: ${file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')}` : '';
            if (file) {
                const imageUrl = new URL(`../assets/presets/${encodeURIComponent(file)}`, import.meta.url);
                presetImage.src = imageUrl.href;
            } else {
                presetImage.removeAttribute('src');
            }
        });

        if (presetSelect.options.length > 1) {
            presetSelect.selectedIndex = 1;
            presetSelect.dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error('Unable to load preset images:', error);
        presetSelect.replaceChildren();
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Preset images unavailable';
        presetSelect.appendChild(option);
        presetStatus.textContent = 'Could not load preset images. Check the preset image manifest and reload.';
    }
}

function handlePresetImagePointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();

    if (!window.EyeDropper) {
        presetStatus.textContent = 'The EyeDropper API is not available in this browser or context.';
        return;
    }
    if (eyeDropperActive) return;

    const targetColor = event.button === 0 ? 'dark' : 'light';
    const eyeDropper = new EyeDropper();
    eyeDropperActive = true;
    eyeDropper.open().then(result => {
        const hex = result.sRGBHex;
        const color = [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16),
            1
        ];
        updateColor(targetColor === 'dark' ? [color, light] : [dark, color]);
        presetStatus.textContent = `${targetColor === 'dark' ? 'Dark' : 'Light'} color set to ${hex}.`;
    }).catch(error => {
        if (error.name === 'AbortError') {
            presetStatus.textContent = 'Color selection cancelled.';
            return;
        }
        console.error('Unable to sample a color:', error);
        presetStatus.textContent = 'Could not open the color picker.';
    }).finally(() => {
        eyeDropperActive = false;
    });
}

presetImage.addEventListener('pointerdown', handlePresetImagePointerDown);
presetImage.addEventListener('contextmenu', event => event.preventDefault());
presetImage.addEventListener('error', () => {
    const file = presetSelect.value;
    console.error(`Unable to load preset image: ${file}`);
    presetStatus.textContent = `Unable to load preset image: ${file}`;
});
loadPresetImages();

export function updateColor(color) {
    dark = color[0];
    colorDark.style.background = `rgba(${dark})`;
    pickerDark.setColor(color[0], true);
    light = color[1];
    colorLight.style.background = `rgba(${light})`;
    pickerLight.setColor(color[1], true);
    currentColors = [dark, light];
}

pickerDark.onOpen = function (color) {
}

pickerDark.onChange = function (color) {
    colorDark.style.background = color.rgbaString;
    dark = color.rgba;
};

pickerDark.onClose = function (color) {
    recentColors.unshift([color.rgba, color.rgbaString]);
    if (recentColors.length > recentLength) recentColors.length = recentLength;
    updateRecentColors();
}

pickerLight.onChange = function (color) {
    colorLight.style.background = color.rgbaString;
    light = color.rgba;
};

pickerLight.onClose = function (color) {
    recentColors.unshift([color.rgba, color.rgbaString]);
    if (recentColors.length > recentLength) recentColors.length = recentLength;
    updateRecentColors();
}

function updateRecentColors() {
    for (let index = 0; index < recentColors.length; index++) {
        const element = recentColors[index][1];
        let recent = document.getElementById(`color${index + 1}`);
        recent.style.background = element;
    }
}

function handleRecentMouseDown(event) {
    const id = event.currentTarget.id; // e.g., "color1"
    const index = Number(id.replace('color', '')) - 1;
    if (index < 0 || index >= recentColors.length) return;

    const [rgbaArray, rgbaString] = recentColors[index];

    if (event.button === 0) { // left click assigns dark
        dark = rgbaArray;
        colorDark.style.background = rgbaString;
    } else if (event.button === 2) { // right click assigns light
        light = rgbaArray;
        colorLight.style.background = rgbaString;
    } else {
        return;
    }

    currentColors = [dark, light];
    updateColor(currentColors);
}

function addRecentColorHandlers() {
    for (let i = 1; i <= recentLength; i++) {
        const el = document.getElementById(`color${i}`);
        if (!el) continue;
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('mousedown', handleRecentMouseDown);
    }
}

function removeRecentColorHandlers() {
    for (let i = 1; i <= recentLength; i++) {
        const el = document.getElementById(`color${i}`);
        if (!el) continue;
        el.removeEventListener('mousedown', handleRecentMouseDown);
    }
}

// Dyanamically add clickable color swatches from commonColors that can be picked for light / dark color
// Build swatches efficiently using a DocumentFragment
function addCommonColorsHandler() {
    const container = document.getElementById('commonColorsContainer');
    if (!container) return;

    // Clear existing swatches before rendering new ones
    container.replaceChildren();

    const fragment = document.createDocumentFragment();

    for (const [name, rgba] of Object.entries(PALETTE_RGBA)) {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'commonColor';
        colorDiv.style.backgroundColor = rgba;
        colorDiv.title = name;

        // Store the raw color data directly on the element
        colorDiv.dataset.rgba = rgba;
        colorDiv.dataset.name = name;

        fragment.appendChild(colorDiv);
    }

    // Single DOM insert operation
    container.appendChild(fragment);

    // Attach event delegation listeners ONCE (if not already attached)
    initColorContainerListeners(container);
}

// Single-line container reset
function removeCommonColorsHandler() {
    const container = document.getElementById('commonColorsContainer');
    if (container) {
        container.replaceChildren();
    }
}

// Separate setup for Event Delegation (runs once)
function initColorContainerListeners(container) {
    if (container.dataset.listenersAttached) return;

    // Left Click -> Set Primary / Dark Color
    // Left Click -> Set Primary / Dark Color
    container.addEventListener('click', (e) => {
        const swatch = e.target.closest('.commonColor');
        if (!swatch) return;

        // 1. Extract and convert string to array: [r, g, b, a]
        const dark = parseRgbaString(swatch.dataset.rgba);

        // 2. Update UI (joining array back to rgba format)
        colorDark.style.backgroundColor = `rgba(${dark.join(',')})`;

        // 3. Update state with proper array format
        currentColors = [dark, currentColors[1]];
        updateColor(currentColors);
    });

    // Right Click -> Set Secondary / Light Color
    container.addEventListener('contextmenu', (e) => {
        const swatch = e.target.closest('.commonColor');
        if (!swatch) return;

        e.preventDefault();

        // 1. Extract and convert string to array: [r, g, b, a]
        const light = parseRgbaString(swatch.dataset.rgba);

        // 2. Update UI
        colorLight.style.backgroundColor = `rgba(${light.join(',')})`;

        // 3. Update state with proper array format
        currentColors = [currentColors[0], light];
        updateColor(currentColors);
    });

    // Flag container so listeners aren't re-bound on re-renders
    container.dataset.listenersAttached = 'true';
}

function blendColors(color1, color2, alpha = 0.5) {
    const blendedColor = color1.map((channel, index) =>
        Math.round(channel * alpha + color2[index] * (1 - alpha))
    );
    return blendedColor;
    //return [...blendedColor, 1]; // Add alpha channel with value 1
}

function blendColor() {
    const newColor = blendColors(dark, light);
    //if (dir == 'right') {
    light = newColor;
    console.log('new color: ', light);
    colorLight.style.background = `rgba(${light})`;
    currentColors = [dark, light];
    //}
}
// Example usage:
//const color1 = [120, 200, 50];
//const color2 = [50, 255, 170];
//const blendedColor = blendColors(color1, color2, 0.5);

function swapColor() {
    [dark, light] = [light, dark];
    updateColor([dark, light]);
}

export function toolbarSwapColor() {
    [dark, light] = [light, dark];
    colorDark.style.background = `rgba(${dark})`;
    colorLight.style.background = `rgba(${light})`;
    currentColors = [dark, light];
    return currentColors;
}

// Helper function to convert "rgba(170, 85, 0, 1)" -> [170, 85, 0, 1]
function parseRgbaString(rgbaStr) {
    return rgbaStr.match(/[\d.]+/g).map(Number);
}

function closePalette() {
    removePaletteEvents();
    container.style.display = 'none';
    currentColors = [dark, light];
    console.log([dark, light]);
    overlay.style.display = 'none';
    addMainEvents();
}

function handleKeyboard(event) {
    switch (event.key) {

        case 'Escape':
        case 'Enter':
            //case 'c':
            //case 'C':
            closePalette();
            break;
    }
}

function addPaletteEvents() {
    document.addEventListener('keydown', handleKeyboard);
    document.getElementById('paletteContainerClose').addEventListener('click', closePalette);
    document.getElementById('swapColorButton').addEventListener('click', swapColor);
    document.getElementById('blendRightButton').addEventListener('click', blendColor);
    addRecentColorHandlers();
    addCommonColorsHandler();
}

function removePaletteEvents() {
    document.removeEventListener('keydown', handleKeyboard);
    document.getElementById('swapColorButton').removeEventListener('click', swapColor);
    document.getElementById('blendRightButton').removeEventListener('click', blendColor);
    removeRecentColorHandlers();
    removeCommonColorsHandler();
}

export function pickColor() {
    container.style.display = 'block';
    if (!colorDark.style.background) colorDark.style.background = '#000';
    if (!colorLight.style.background) colorLight.style.background = '#fff';

    addPaletteEvents();
}