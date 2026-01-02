import { getImageFromSheet, getDataFromSheet } from './sprite-sheet.js';
import { createDataURL } from './sprite.js';
import { pickColor, toolbarSwapColor } from './palette.js';
import { editSprite } from './sprite-editor.js';

//const canvas = document.getElementById('lowToleranceCanvas');
//const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const spriteValue = document.getElementById('currentSprite');
const spriteImage = document.getElementById('currentSpriteImage');
const darkColor = document.getElementById('colorBoxDark');
const lightColor = document.getElementById('colorBoxLight');
const spriteType = document.getElementById('spriteType');
const swapColor = document.getElementById('swapButton');
const paletteButton = document.getElementById('paletteButton');
const spriteButton = document.getElementById('spriteButton');
const layerButtons = [null, document.getElementById('layer1Button'), document.getElementById('layer2Button'), document.getElementById('layer3Button')];
const layerOpacity = document.getElementById('3-opacity');
const boardLayers = [null, document.getElementById('layer1'), document.getElementById('layer2'), document.getElementById('layer3')];
const spriteTypes = [document.getElementById('wall'), document.getElementById('step'), document.getElementById('break'), document.getElementById('push'), document.getElementById('other')];
const terrainButton = document.getElementById('terrainButton');
const itemButton = document.getElementById('itemButton');
const creatureButton = document.getElementById('creatureButton');
const editMode = document.getElementById('editMode');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');
const modeButtons = {
  draw: document.getElementById('modeButtonDraw'),
  fill: document.getElementById('modeButtonFill'),
  paint: document.getElementById('modeButtonPaint'),
  lighten: document.getElementById('modeButtonLighten'),
  darken: document.getElementById('modeButtonDarken'),
};

//const toolBarSize = 320; // Right side toolbar sized in tiles
let colors = [[0, 0, 0, 1], [255, 255, 255, 1]];
let mouseStatus = {};
let oldData = [];
let oldColors = [];
let newCurrent = 0;
let hidden = new Set();
let callbackFunction = () => { };

swapColor.onclick = () => {
  colors = toolbarSwapColor();
  darkColor.style.background = `rgba(${colors[0][0]},${colors[0][1]}, ${colors[0][2]}, ${colors[0][3]})`;
  lightColor.style.background = `rgba(${colors[1][0]},${colors[1][1]}, ${colors[1][2]}, ${colors[1][3]})`;
}

paletteButton.onclick = () => {
  removeMainEvents(); // remove main.js canvas events
  overlay.style.display = 'block';
  pickColor();
}

spriteButton.onclick = () => {
  removeMainEvents(); // remove main.js canvas events
  overlay.style.display = 'block';
  editSprite(newCurrent, (newIndex) => {
    // Notify main via toolbar callback
    callbackFunction({ current: newIndex });
    overlay.style.display = 'none';
  });
}

boardLayers.forEach((element, index) => {
  if (index > 0) {
    element.onclick = () => {
      callbackFunction({ layer: index, hidden });
    }
  }
});

layerButtons.forEach((element, index) => {
  if (index > 0) {
    element.onclick = () => {
      if (hidden.has(index)) {
        hidden.delete(index);
      } else {
        hidden.add(index);
      }
      callbackFunction({ hidden });
    }
  }
});

export function updateLayers(layer) {
  const button = layerButtons[layer];
  if (!button) return;

  const isHidden = hidden.has(layer);
  button.innerText = isHidden ? 'visibility_off' : 'visibility';
}


spriteTypes.forEach((element) => { 
  element.onclick = () => {
    const type = element.id;
    if (type === 'other') return;
    callbackFunction({ type });
  }
});

if (terrainButton) {
  terrainButton.onclick = () => {
    callbackFunction({ popup: 'extraTerrain' });
  };
}

if (itemButton) {
  itemButton.onclick = () => {
    callbackFunction({ popup: 'extraItems' });
  };
}

if (creatureButton) {
  creatureButton.onclick = () => {
    callbackFunction({ popup: 'extraCreatures' });
  };
}

if (undoButton) {
  undoButton.onclick = () => {
    callbackFunction({ history: 'undo' });
  };
}

if (redoButton) {
  redoButton.onclick = () => {
    callbackFunction({ history: 'redo' });
  };
}

Object.entries(modeButtons).forEach(([mode, button]) => {
  if (!button) return;
  button.onclick = () => {
    callbackFunction({ mode });
  };
});

export function toolbar(current, currentColors, layer, mouse, hiddenLayers, callback, currentType) { // Main toolbar function
  //console.log('Function called from toolbar.js');
  //const leftSide = canvas.width - toolBarSize;
  colors = currentColors || [[0, 0, 0, 1], [255, 255, 255, 1]];
  mouseStatus = mouse;
  hidden = hiddenLayers;
  newCurrent = current;
  callbackFunction = callback;

  //console.log('toolbar hidden:', hidden);

  spriteValue.innerHTML = current;
  let spriteData = getDataFromSheet(current);

  if (spriteData !== oldData || colors !== oldColors) { // fix for image flashing
    // Handle the promise
    createDataURL(spriteData, colors[0], colors[1]).then((img) => {
      //console.log('Image created:', img);

      // Clear previous image and append new one
      spriteImage.innerHTML = ''; // Clears previous content
      spriteImage.appendChild(img);
    }).catch((error) => {
      console.error('Error creating image:', error);
    });
  }

  oldData = spriteData; // fix for image flashing
  oldColors = colors; // fix for image flashing
  // if (getImageFromSheet(current) !== undefined) spriteImage.appendChild = dataURL;

  darkColor.style.background = `rgba(${colors[0][0]},${colors[0][1]}, ${colors[0][2]}, ${colors[0][3]})`;
  lightColor.style.background = `rgba(${colors[1][0]},${colors[1][1]}, ${colors[1][2]}, ${colors[1][3]})`;

  // Draw layer number
  boardLayers.forEach((element, index) => {
    if (index > 0) { 
      element.style.background = index === layer ? '#5f76aa' : '#2e4675';
    }
  });
  // Visibility buttons visibility_off
  layerButtons.forEach((element, index) => { 
    if (index > 0) {
      element.style.background = index === layer ? '#f0f0f0' : '#2e4675';
      //element.style.color = index === layer ? '#131313' : '#5f76aa';
      element.innerText = !hidden.has(index) ? 'visibility' : 'visibility_off';
      
    }
  });

  layerOpacity.onchange = () => {
    console.log('opacity:', layerOpacity.value * 5);
  }

  spriteType.innerText = currentType || 'wall';

  const modeLabel = mouseStatus.mode || 'draw';
  const formattedMode = modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1);
  editMode.innerText = formattedMode;

  Object.entries(modeButtons).forEach(([mode, button]) => {
    if (!button) return;
    if (modeLabel === mode) {
      button.classList.add('modeButton-active');
    } else {
      button.classList.remove('modeButton-active');
    }
  });
}

export function updateType (type) { // Update sprite type in toolbar
  spriteTypes.forEach((element) => {
    //element = index === type ? element.checked = true;
    if (element.id === type) {
      element.checked = true;
    }
  });
  if (type !== 'wall' && type !== 'step' && type !== 'break' && type !== 'push') {
    //spriteTypes.forEach((element) => {
      //element.checked = false;
    //})
    spriteTypes[4].checked = true;
  }
}