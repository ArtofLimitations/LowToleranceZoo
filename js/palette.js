import Picker from './modules/vanilla-picker.js';
//import { updateSpriteColor } from './sprite.js';

const container = document.getElementById('paletteContainer');

let dark = [0, 0, 0, 1];
let light = [255, 255, 255, 1];
let colorDark = document.getElementById('colorDark');
let colorLight = document.getElementById('colorLight');
let pickerDark = new Picker(colorDark);
let pickerLight = new Picker(colorLight);

export let currentColors = [[0, 0, 0, 1],[255, 255, 255, 1]];

/*
    You can do what you want with the chosen color using two callbacks: onChange and onDone.
*/
pickerDark.onChange = function (color) {
    console.log(color.rgba);
    colorDark.style.background = color.rgbaString;
    dark = color.rgba;
};

pickerLight.onChange = function (color) {
    colorLight.style.background = color.rgbaString;
    light = color.rgba;
};

function handleKeyboard(event) {
    switch (event.key) {

        case 'Escape':
            removePaletteEvents();
            container.style.display = 'none';
            //updateSpriteColor(dark, light);
            currentColors = [dark, light];
            addMainEvents();
            break;
    }
}

function addPaletteEvents() {
    document.addEventListener('keydown', handleKeyboard);
}

function removePaletteEvents() {
    document.removeEventListener('keydown', handleKeyboard);
}

export function pickColor() {

    container.style.display = 'block';
    if (!colorDark.style.background) colorDark.style.background = '#000';
    if (!colorLight.style.background) colorLight.style.background = '#fff';

    addPaletteEvents();
}