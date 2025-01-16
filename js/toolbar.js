import { getImageFromSheet } from './sprite-sheet.js';
import { pickColor, toolbarSwapColor } from './palette.js';

const canvas = document.getElementById('lowToleranceCanvas');
const ctx = canvas.getContext('2d');

const toolBarSize = 320; // Right side toolbar sized in tiles
let colors = [[0, 0, 0, 1], [255, 255, 255, 1]];
let mouseStatus = {};

const buttons = [
  { x: 10, y: 100, width: 80, height: 40, type: 'text', label: 'Button 1' },
  { x: 10, y: 150, width: 80, height: 40, type: 'text', label: 'Button 2' },
  { x: 10, y: 200, width: 80, height: 40, type: 'text', label: 'Button 3' },
  { x: 116, y: 533, width: 32, height: 30, type: 'icon', label: 'swap_horiz' },
  { x: 188, y: 533, width: 32, height: 30, type: 'icon', label: 'palette' },
  { x: 80, y: 633, width: 32, height: 30, type: 'icon', label: 'visibility' }
]

// In toolbar.js
export function toolbar(current, currentColors, layer, mouse) {
  //console.log('Function called from toolbar.js');
  const leftSide = canvas.width - toolBarSize;
  colors = currentColors || [[0, 0, 0, 1], [255, 255, 255, 1]];
  mouseStatus = mouse;

  // Draw toolbar
  ctx.beginPath();
  ctx.rect(canvas.width - toolBarSize, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2c3d63";
  ctx.fill();

  // Draw title
  ctx.beginPath();
  ctx.fillStyle = "#addcca";
  ctx.font = "32px Helvetica, Arial, Sans-Serif";
  ctx.fillText("Low Tolerance Zoo", canvas.width - toolBarSize + 10, 48);

  // Draw sprite and color bar
  ctx.beginPath();
  ctx.fillStyle = '#222';
  ctx.fillRect(leftSide, 532, 76, 32);

  // Draw sprite number
  ctx.beginPath();
  ctx.fillStyle = "#addcca";
  ctx.font = "16px Helvetica, Arial, Sans-Serif";
  ctx.fillText(current, leftSide + 10, 554);

  // Draw current sprite
  if (getImageFromSheet(current) !== undefined) ctx.putImageData(getImageFromSheet(current), leftSide + 44, 548 - 16);
  //let colors = currentColors || [[0, 0, 0, 1], [255, 255, 255, 1]];

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
}