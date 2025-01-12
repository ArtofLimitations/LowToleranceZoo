const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d');

let lastTime = 0;
const speed = 0.5; // Speed control: lower is slower, higher is faster
let position = 0;  // Position of the animated object

export function animate(currentTime) {
    const deltaTime = currentTime - lastTime;

    if (deltaTime > 1000 / 60) { // 60 FPS cap
        // Update the position based on the speed and deltaTime
        position += speed * (deltaTime / 1000) * 60;
        lastTime = currentTime;
    }

    // Clear the canvas (optional, depends on what you're animating)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the animated object (a simple rectangle for example)
    ctx.fillStyle = 'red';
    ctx.fillRect(position, canvas.height / 2 - 25, 50, 50); // Draw rectangle at new position

    // Loop the animation
    requestAnimationFrame(animate);
}

canvas.addEventListener('mousedown', (event) => { 
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left)); 
    const y = Math.floor((event.clientY - rect.top)); 
    position = x;
});

// Start the animation
//requestAnimationFrame(animate);