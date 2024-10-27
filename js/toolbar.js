const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

const buttons = [
  { x: 10, y: 100, width: 80, height: 40, label: 'Button 1' },
  { x: 10, y: 150, width: 80, height: 40, label: 'Button 2' },
  { x: 10, y: 200, width: 80, height: 40, label: 'Button 3' }
]

// In toolbar.js
export function toolbar(size) {
  //console.log('Function called from toolbar.js');

  const leftSide = canvas.width - size;

  // Draw toolbar
  ctx.beginPath();
  ctx.rect(canvas.width - size, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2c3d63";
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#addcca";
  ctx.font = "48px Helvetica, Arial, Sans-Serif";
  ctx.fillText("TOOLBAR", canvas.width - size, 48);

  // Draw toolbar buttons

  buttons.forEach(button => {
    ctx.fillStyle = '#f7f8f3';
    ctx.fillRect(leftSide + button.x, button.y, button.width, button.height);

    ctx.fillStyle = '#222';
    ctx.font = '16px Arial';
    ctx.fillText(button.label, leftSide + button.x + 10, button.y + 25);
  });
}

function isInsideButton(bX, x, y, button) {
  return (
    x > bX + button.x && x < bX + button.x + button.width &&
    y > button.y && y < button.y + button.height
  );
}

export function toolbarClicked(x, y, size) {
  let offsetX = canvas.width - size;
  buttons.forEach(button => {
    if (isInsideButton(offsetX, x, y, button)) {
      alert(`${button.label} clicked!`);
    }
  });
}