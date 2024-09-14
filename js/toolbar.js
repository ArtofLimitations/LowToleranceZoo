const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');


const buttons = [
  { x: 10, y: 100, width: 80, height: 40, label: 'Button 1' },
  { x: 10, y: 150, width: 80, height: 40, label: 'Button 2' },
  { x: 10, y: 200, width: 80, height: 40, label: 'Button 3' }
]

// In toolbar.js
export function toolbar(size) {
  console.log('Function called from toolbar.js');

  const leftSide = canvas.width - size;

  // Draw toolbar
  ctx.beginPath();
  ctx.rect(canvas.width - size, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#333";
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#FFF";
  ctx.font = "48px Helvetica, Arial, Sans-Serif";
  ctx.fillText("TOOLBAR", canvas.width - size, 48);

  // Draw toolbar buttons

  buttons.forEach(button => {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(leftSide + button.x, button.y, button.width, button.height);

    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.fillText(button.label, leftSide + button.x + 10, button.y + 25);
  });

  /*canvas.addEventListener('click', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
  
    buttons.forEach(button => {
      if (isInsideButton(x, y, button)) {
        alert(`${button.label} clicked!`);
      }
    });*/
}

function isInsideButton(bX, x, y, button) {
  return (
    x > bX + button.x && x < bX + button.x + button.width &&
    y > button.y && y < button.y + button.height
  );
}

export function toolbarClicked(x, y, size) {
  let buttonX = canvas.width - size;
  buttons.forEach(button => {
    if (isInsideButton(buttonX, x, y, button)) {
      alert(`${button.label} clicked!`);
    }
  });
}
