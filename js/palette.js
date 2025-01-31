import Picker from './modules/vanilla-picker.js';
//import { updateSpriteColor } from './sprite.js';

const container = document.getElementById('paletteContainer');

const recentLength = 5;
let dark = [0, 0, 0, 1];
let light = [255, 255, 255, 1];
let colorDark = document.getElementById('colorDark');
let colorLight = document.getElementById('colorLight');
let recentColors = [];
let pickerDark = new Picker({ parent: colorDark, alpha: false, color: dark });
let pickerLight = new Picker({ parent: colorLight, alpha: false, color: light });

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

function swapColor () {
    [dark, light] = [light, dark];
    updateColor([dark, light]);
}

export function toolbarSwapColor () {
    [dark, light] = [light, dark];
    colorDark.style.background = `rgba(${dark})`;
    colorLight.style.background = `rgba(${light})`;
    currentColors = [dark, light];
    return currentColors;
}

function handleKeyboard(event) {
    switch (event.key) {

        case 'Escape':
        case 'Enter':
        //case 'c':
        //case 'C':
            removePaletteEvents();
            container.style.display = 'none';
            currentColors = [dark, light];
            console.log([dark, light]);
            addMainEvents();
            break;
    }
}

function addPaletteEvents() {
    document.addEventListener('keydown', handleKeyboard);
    document.getElementById('swapColorButton').addEventListener('click', swapColor);
    document.getElementById('blendRightButton').addEventListener('click', blendColor);
}

function removePaletteEvents() {
    document.removeEventListener('keydown', handleKeyboard);
    document.getElementById('swapColorButton').removeEventListener('click', swapColor);
    document.getElementById('blendRightButton').removeEventListener('click', blendColor);
}

export function pickColor() {
    container.style.display = 'block';
    if (!colorDark.style.background) colorDark.style.background = '#000';
    if (!colorLight.style.background) colorLight.style.background = '#fff';

    addPaletteEvents();
}