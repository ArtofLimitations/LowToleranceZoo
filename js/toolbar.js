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
const swapColor = document.getElementById('swapButton');
const paletteButton = document.getElementById('paletteButton');
const spriteButton = document.getElementById('spriteButton');
const layerButtons = [null, document.getElementById('layer1Button'), document.getElementById('layer2Button'), document.getElementById('layer3Button')];
const boardLayers = [null, document.getElementById('layer1'), document.getElementById('layer2'), document.getElementById('layer3')];
const spriteTypes = [document.getElementById('wall'), document.getElementById('item'), document.getElementById('break'), document.getElementById('push')];
const editMode = document.getElementById('editMode');

//const toolBarSize = 320; // Right side toolbar sized in tiles
let colors = [[0, 0, 0, 1], [255, 255, 255, 1]];
let mouseStatus = {};
let oldData = [];
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
  editSprite(newCurrent);
}

boardLayers.forEach((element, index) => {
  if (index > 0) {
    element.onclick = () => {
      callbackFunction(index, hidden);
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
      callbackFunction( undefined, hidden);
    }
  }
});

spriteTypes.forEach((element, index) => { 
  element.onclick = () => {
    const type = element.id;
    callbackFunction( undefined, undefined, type);
  }
});

export function toolbar(current, currentColors, layer, mouse, hiddenLayers, callback) { // Main toolbar function
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

  if (spriteData !== oldData) { // fix for image not updating
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

  oldData = spriteData; // fix for image not updating
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

  editMode.innerText = mouseStatus.mode;

}

export function updateType (type) { // Update sprite type in toolbar
  spriteTypes.forEach((element) => {
    //element = index === type ? element.checked = true;
    if (element.id === type) {
      element.checked = true;
    }
  });
}
/*
  // Draw Dark Color
  ctx.beginPath();
  ctx.rect(leftSide + 80, 548 - 16, 32, 32);
  ctx.fillStyle = `rgba(${colors[0][0]},${colors[0][1]}, ${colors[0][2]}, ${colors[0][3]})`;
  ctx.fill();

  // Draw Light Color
  ctx.beginPath();
  ctx.rect(leftSide + 152, 548 - 16, 32, 32);
  ctx.fillStyle = `rgba(${colors[1][0]},${colors[1][1]}, ${colors[1][2]}, ${colors[1][3]})`;
  ctx.fill();

  // Draw layer number
  ctx.beginPath();
  ctx.fillStyle = '#222';
  ctx.fillRect(leftSide, 632, 76, 32);

  ctx.beginPath();
  ctx.fillStyle = "#f7f8f3";
  ctx.font = "16px Helvetica, Arial, Sans-Serif";
  ctx.fillText('Layer:', leftSide + 10, 654);

  ctx.beginPath();
  ctx.fillStyle = "#addcca";
  ctx.font = "16px Helvetica, Arial, Sans-Serif";
  ctx.fillText(layer, leftSide + 58, 654);

  // Status Bar
  ctx.beginPath();
  ctx.fillStyle = '#222';
  ctx.fillRect(leftSide, canvas.height - 32, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.fillStyle = "#f7f8f3";
  ctx.font = "16px Helvetica, Arial, Sans-Serif";
  ctx.fillText('Mode:', leftSide + 10, canvas.height - 11);

  ctx.beginPath();
  ctx.fillStyle = "#addcca";
  ctx.font = "16px Helvetica, Arial, Sans-Serif";
  ctx.fillText(mouseStatus.mode, leftSide + 58, canvas.height - 11);

  ctx.beginPath();
  ctx.fillStyle = "#f7f8f3";
  ctx.font = "16px Helvetica, Arial, Sans-Serif";
  ctx.fillText('x:     y:', leftSide + 110, canvas.height - 11);

  ctx.beginPath();
  ctx.fillStyle = "#addcca";
  ctx.font = "16px Helvetica, Arial, Sans-Serif";
  ctx.fillText(mouseStatus.x, leftSide + 124, canvas.height - 11);
  ctx.fillText(mouseStatus.y, leftSide + 160, canvas.height - 11);

  // Draw buttons
  buttons.forEach(button => {
    switch (button.type) {
      case 'text':
        // Draw toolbar TEXT buttons
        ctx.fillStyle = '#f7f8f3';
        ctx.fillRect(leftSide + button.x, button.y, button.width, button.height);

        ctx.fillStyle = '#222';
        ctx.font = '16px Arial';
        ctx.fillText(button.label, leftSide + button.x + 10, button.y + 25);
        break;
      case 'icon':
        // Draw toolbar ICON buttons
        ctx.beginPath();
        ctx.filter = "blur(8px)";
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.filter = "none";
        ctx.fillRect(leftSide + button.x, button.y, button.width, button.height + 2);
        ctx.fillStyle = '#555';
        ctx.fillRect(leftSide + button.x, button.y, button.width, button.height);

        ctx.fillStyle = '#eee';
        //ctx.font = '16px Arial';
        ctx.font = '16px Material Symbols Outlined';
        ctx.fillText(button.label, leftSide + button.x + 9, button.y + 23);
        break;
    }
  });
}

function isInsideButton(bX, x, y, button) {
  return (
    x > bX + button.x && x < bX + button.x + button.width &&
    y > button.y && y < button.y + button.height
  );
}

export function toolbarClicked(x, y) {
  let offsetX = canvas.width - toolBarSize;
  buttons.forEach(button => {
    if (isInsideButton(offsetX, x, y, button)) {
      //alert(`${button.label} clicked!`);
      switch (button.label) {
        case 'palette':
          removeMainEvents(); // remove main.js canvas events
          pickColor(); // pick a color from palette.js
          break;
        case 'swap_horiz':
          colors = toolbarSwapColor(); // swap colors from palette.js
          // Draw Dark Color
          ctx.beginPath();
          ctx.rect(offsetX + 80, 548 - 16, 32, 32);
          ctx.fillStyle = `rgba(${colors[0][0]},${colors[0][1]}, ${colors[0][2]}, ${colors[0][3]})`;
          ctx.fill();

          // Draw Light Color
          ctx.beginPath();
          ctx.rect(offsetX + 152, 548 - 16, 32, 32);
          ctx.fillStyle = `rgba(${colors[1][0]},${colors[1][1]}, ${colors[1][2]}, ${colors[1][3]})`;
          ctx.fill();
          break;
      }
    }
  });
}*/