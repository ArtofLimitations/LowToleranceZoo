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

export const PALETTE_RGBA = {
    // --- REDS & BROWNS ---
    maroon: "rgba(128, 0, 0, 1)",
    dosRed: "rgba(170, 0, 0, 1)",              // DOS 4: Low Red
    darkred: "rgba(139, 0, 0, 1)",
    firebrick: "rgba(178, 34, 34, 1)",
    crimson: "rgba(220, 20, 60, 1)",
    red: "rgba(255, 0, 0, 1)",
    dosLightRed: "rgba(255, 85, 85, 1)",       // DOS 12: Light Red
    indianred: "rgba(205, 92, 92, 1)",
    lightcoral: "rgba(240, 128, 128, 1)",
    salmon: "rgba(250, 128, 114, 1)",
    darksalmon: "rgba(233, 150, 122, 1)",
    lightsalmon: "rgba(255, 160, 122, 1)",
    saddlebrown: "rgba(139, 69, 19, 1)",
    sienna: "rgba(160, 82, 45, 1)",
    dosBrown: "rgba(170, 85, 0, 1)",           // DOS 6: True DOS Brown / Dark Yellow
    chocolate: "rgba(210, 105, 30, 1)",
    peru: "rgba(205, 133, 63, 1)",
    rosybrown: "rgba(188, 143, 143, 1)",
    sandybrown: "rgba(244, 164, 96, 1)",
    burlywood: "rgba(222, 184, 135, 1)",
    tan: "rgba(210, 180, 140, 1)",

    // --- ORANGES & YELLOWS ---
    orangered: "rgba(255, 69, 0, 1)",
    tomato: "rgba(255, 99, 71, 1)",
    coral: "rgba(255, 127, 80, 1)",
    darkorange: "rgba(255, 140, 0, 1)",
    orange: "rgba(255, 165, 0, 1)",
    darkgoldenrod: "rgba(184, 134, 11, 1)",
    goldenrod: "rgba(218, 165, 32, 1)",
    gold: "rgba(255, 215, 0, 1)",
    yellow: "rgba(255, 255, 0, 1)",
    dosYellow: "rgba(255, 255, 85, 1)",        // DOS 14: Light Yellow
    palegoldenrod: "rgba(238, 232, 170, 1)",
    khaki: "rgba(240, 230, 140, 1)",
    darkkhaki: "rgba(189, 183, 107, 1)",
    olive: "rgba(128, 128, 0, 1)",
    greenyellow: "rgba(173, 255, 47, 1)",
    chartreuse: "rgba(127, 255, 0, 1)",
    lawngreen: "rgba(124, 252, 0, 1)",

    // --- GREENS ---
    lime: "rgba(0, 255, 0, 1)",
    dosLightGreen: "rgba(85, 255, 85, 1)",      // DOS 10: Light Green
    limegreen: "rgba(50, 205, 50, 1)",
    springgreen: "rgba(0, 255, 127, 1)",
    mediumspringgreen: "rgba(0, 250, 154, 1)",
    darkgreen: "rgba(0, 100, 0, 1)",
    green: "rgba(0, 128, 0, 1)",
    dosGreen: "rgba(0, 170, 0, 1)",            // DOS 2: Low Green
    forestgreen: "rgba(34, 139, 34, 1)",
    seagreen: "rgba(46, 139, 87, 1)",
    mediumseagreen: "rgba(60, 179, 113, 1)",
    darkolivegreen: "rgba(85, 107, 47, 1)",
    olivedrab: "rgba(107, 142, 35, 1)",
    darkseagreen: "rgba(143, 188, 143, 1)",
    lightgreen: "rgba(144, 238, 144, 1)",
    palegreen: "rgba(152, 251, 152, 1)",

    // --- CYANS & TEALS ---
    teal: "rgba(0, 128, 128, 1)",
    dosCyan: "rgba(0, 170, 170, 1)",           // DOS 3: Low Cyan
    darkcyan: "rgba(0, 139, 139, 1)",
    lightseagreen: "rgba(32, 178, 170, 1)",
    cadetblue: "rgba(95, 158, 160, 1)",
    darkturquoise: "rgba(0, 206, 209, 1)",
    mediumturquoise: "rgba(72, 209, 204, 1)",
    turquoise: "rgba(64, 224, 208, 1)",
    cyan: "rgba(0, 255, 255, 1)",
    aqua: "rgba(0, 255, 255, 1)",
    dosLightCyan: "rgba(85, 255, 255, 1)",     // DOS 11: Light Cyan
    aquamarine: "rgba(127, 255, 212, 1)",
    mediumaquamarine: "rgba(102, 205, 170, 1)",
    paleturquoise: "rgba(175, 238, 238, 1)",
    lightcyan: "rgba(224, 255, 255, 1)",

    // --- BLUES ---
    midnightblue: "rgba(25, 25, 112, 1)",
    navy: "rgba(0, 0, 128, 1)",
    dosBlue: "rgba(0, 0, 170, 1)",             // DOS 1: Low Blue
    darkblue: "rgba(0, 0, 139, 1)",
    mediumblue: "rgba(0, 0, 205, 1)",
    blue: "rgba(0, 0, 255, 1)",
    dosLightBlue: "rgba(85, 85, 255, 1)",      // DOS 9: Light Blue
    royalblue: "rgba(65, 105, 225, 1)",
    steelblue: "rgba(70, 130, 180, 1)",
    dodgerblue: "rgba(30, 144, 255, 1)",
    deepskyblue: "rgba(0, 191, 255, 1)",
    cornflowerblue: "rgba(100, 149, 237, 1)",
    skyblue: "rgba(135, 206, 235, 1)",
    lightskyblue: "rgba(135, 206, 250, 1)",
    lightblue: "rgba(173, 216, 230, 1)",
    powderblue: "rgba(176, 224, 230, 1)",

    // --- PURPLES & MAGENTAS ---
    indigo: "rgba(75, 0, 130, 1)",
    purple: "rgba(128, 0, 128, 1)",
    dosMagenta: "rgba(170, 0, 170, 1)",        // DOS 5: Low Magenta
    darkmagenta: "rgba(139, 0, 139, 1)",
    darkviolet: "rgba(148, 0, 211, 1)",
    darkslateblue: "rgba(72, 61, 139, 1)",
    blueviolet: "rgba(138, 43, 226, 1)",
    darkorchid: "rgba(153, 50, 204, 1)",
    fuchsia: "rgba(255, 0, 255, 1)",
    magenta: "rgba(255, 0, 255, 1)",
    dosLightMagenta: "rgba(255, 85, 255, 1)",  // DOS 13: Light Magenta
    mediumvioletred: "rgba(199, 21, 133, 1)",
    deeppink: "rgba(255, 20, 147, 1)",
    mediumorchid: "rgba(186, 85, 211, 1)",
    mediumpurple: "rgba(147, 112, 219, 1)",
    slateblue: "rgba(106, 90, 205, 1)",
    mediumslateblue: "rgba(123, 104, 238, 1)",
    orchid: "rgba(218, 112, 214, 1)",
    violet: "rgba(238, 130, 238, 1)",
    plum: "rgba(221, 160, 221, 1)",

    // --- PINKS & LIGHT PASTELS ---
    hotpink: "rgba(255, 105, 180, 1)",
    palevioletred: "rgba(219, 112, 147, 1)",
    lightpink: "rgba(255, 182, 193, 1)",
    pink: "rgba(255, 192, 203, 1)",
    thistle: "rgba(216, 191, 216, 1)",
    mistyrose: "rgba(255, 228, 225, 1)",
    blanchedalmond: "rgba(255, 235, 205, 1)",
    bisque: "rgba(255, 228, 196, 1)",
    moccasin: "rgba(255, 228, 181, 1)",
    peachpuff: "rgba(255, 218, 185, 1)",
    navajowhite: "rgba(255, 222, 173, 1)",
    papayawhip: "rgba(255, 239, 213, 1)",
    cornsilk: "rgba(255, 248, 220, 1)",
    lemonchiffon: "rgba(255, 250, 205, 1)",
    lightyellow: "rgba(255, 255, 224, 1)",

    // --- GRAYS & NEUTRALS ---
    black: "rgba(0, 0, 0, 1)",                 // DOS 0: Black
    dosDarkGray: "rgba(85, 85, 85, 1)",        // DOS 8: Dark Gray
    dimgray: "rgba(105, 105, 105, 1)",
    gray: "rgba(128, 128, 128, 1)",
    darkgray: "rgba(169, 169, 169, 1)",
    darkslategray: "rgba(47, 79, 79, 1)",
    slategray: "rgba(112, 128, 144, 1)",
    lightslategray: "rgba(119, 136, 153, 1)",
    lightsteelblue: "rgba(176, 196, 222, 1)",
    dosLightGray: "rgba(170, 170, 170, 1)",     // DOS 7: Light Gray
    silver: "rgba(192, 192, 192, 1)",
    lightgray: "rgba(211, 211, 211, 1)",
    gainsboro: "rgba(220, 220, 220, 1)",

    // --- WHITES & OFF-WHITES ---
    lavender: "rgba(230, 230, 250, 1)",
    aliceblue: "rgba(240, 248, 255, 1)",
    ghostwhite: "rgba(248, 248, 255, 1)",
    honeydew: "rgba(240, 255, 240, 1)",
    mintcream: "rgba(245, 255, 250, 1)",
    azure: "rgba(240, 255, 255, 1)",
    seashell: "rgba(255, 245, 238, 1)",
    floralwhite: "rgba(255, 250, 240, 1)",
    oldlace: "rgba(253, 245, 230, 1)",
    linen: "rgba(250, 240, 230, 1)",
    antiquewhite: "rgba(250, 235, 215, 1)",
    beige: "rgba(245, 245, 220, 1)",
    ivory: "rgba(255, 255, 240, 1)",
    whitesmoke: "rgba(245, 245, 245, 1)",
    snow: "rgba(255, 250, 250, 1)",
    white: "rgba(255, 255, 255, 1)"            // DOS 15: Bright White
};

export let currentColors = [[0, 0, 0, 1], [255, 255, 255, 1]];

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