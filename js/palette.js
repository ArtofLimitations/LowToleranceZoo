import Picker from './modules/vanilla-picker.js';
//import { updateSpriteColor } from './sprite.js';

const container = document.getElementById('paletteContainer');
const canvas = document.getElementById('tileCanvas');

let dark = [0, 0, 0, 1];
let light = [255, 255, 255, 1];
let colorDark = document.getElementById('colorDark');
let colorLight = document.getElementById('colorLight');
let recentColors = [];
const recentLength = 5;

//let pickerDark = new Picker({ parent: colorDark, alpha: false, color: '#222222' });
//let pickerLight = new Picker({ parent: colorLight, alpha: false, color: 'pink' });
let pickerDark = new Picker({ parent: colorDark, alpha: false, color: dark });
let pickerLight = new Picker({ parent: colorLight, alpha: false, color: light });

export let currentColors = [[0, 0, 0, 1], [255, 255, 255, 1]];

export function updateColor(color) {
    //pickerLight.setColor = color[1];
    //window.pickerDark.setColor(color[0], true);
    dark = color[0];
    colorDark.style.background = `rgba(${dark})`;
    pickerDark.setColor(color[0], true);
    light = color[1];
    colorLight.style.background = `rgba(${light})`;
    pickerLight.setColor(color[1], true);
}

pickerDark.onOpen = function (color) {

}

pickerDark.onChange = function (color) {
    //console.log('color changed to: ', color.rgba);
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

function swapColor () {
    //updateColor([[light], [dark]]);
    [dark, light] = [light, dark];
    colorDark.style.background = `rgba(${dark})`;
    colorLight.style.background = `rgba(${light})`;
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
}

function removePaletteEvents() {
    document.removeEventListener('keydown', handleKeyboard);
    document.getElementById('swapColorButton').removeEventListener('click', swapColor);
}

export function pickColor() {

    container.style.display = 'block';
    if (!colorDark.style.background) colorDark.style.background = '#000';
    if (!colorLight.style.background) colorLight.style.background = '#fff';

    addPaletteEvents();
}