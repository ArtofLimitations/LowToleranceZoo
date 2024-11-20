import Picker from './modules/vanilla-picker.js';
//import { updateSpriteColor } from './sprite.js';

const container = document.getElementById('paletteContainer');

let dark = [0, 0, 0, 1];
let light = [255, 255, 255, 1];
let colorDark = document.getElementById('colorDark');
let colorLight = document.getElementById('colorLight');
let recentColors = [];
const recentLength = 5;

let pickerDark = new Picker({ parent: colorDark, alpha: false, color: '#222222' });
let pickerLight = new Picker({ parent: colorLight, alpha: false, color: 'pink' });

export let currentColors = [[0, 0, 0, 1],[255, 255, 255, 1]];

export function updateColor (color) {
    pickerDark.setColor = color[0];
    pickerLight.setColor = color[1];
}

pickerDark.onChange = function (color) {
    //console.log(color.rgba);
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

function updateRecentColors () {
    for (let index = 0; index < recentColors.length; index++) {
        const element = recentColors[index][1];
        let recent = document.getElementById(`color${index + 1}`);
        recent.style.background = element;
    }
}

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