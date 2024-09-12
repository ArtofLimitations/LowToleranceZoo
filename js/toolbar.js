const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

let toolBarSize, tileSize;

// In toolbar.js
export function toolbar(width, size) {
    console.log('Function called from toolbar.js');
    toolBarSize = width * 32;
    tileSize = size;
    const buttons = [
        { x: 110, y: 50, width: 80, height: 40, label: 'Button 1' },
        { x: 210, y: 50, width: 80, height: 40, label: 'Button 2' },
        { x: 310, y: 50, width: 80, height: 40, label: 'Button 3' }
    ]

    // Draw toolbar
    ctx.beginPath();
    ctx.rect(canvas.width - toolBarSize, 0, canvas.width, Math.floor(canvas.height / tileSize) * tileSize);
    ctx.fillStyle = "#333";
    ctx.fill();
    ctx.fillStyle = "#FFF";
    ctx.font = "48px Helvetica, Arial, Sans-Serif";
    ctx.fillText("TOOLBAR", canvas.width - toolBarSize, 48);

    // Draw toolbar with buttons
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    buttons.forEach(button => {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(button.x, button.y, button.width, button.height);

        ctx.fillStyle = '#000';
        ctx.font = '16px Arial';
        ctx.fillText(button.label, button.x + 10, button.y + 25);
    });

    function isInsideButton(x, y, button) {
        return (
          x > button.x && x < button.x + button.width &&
          y > button.y && y < button.y + button.height
        );
      }

      
};

/*function handleToolClick(event) {

}

canvas.addEventListener('click', handleToolClick);*/