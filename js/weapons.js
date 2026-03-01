// Weapons module
// Init: js/player.js
//const canvas = document.getElementById('lowToleranceCanvas');
//const ctx = canvas.getContext('2d'); 

// Centralized weapon definitions keyed by ID for reference from player-stats
export const weaponDefinitions = {
    pistol: {
        name: "Pistol",
        damage: 10,
        fireRate: 400,
        projectileSize: 8,
        speed: 16,
        color: "white"
    }
};

export function createBullet (canvas, x, y, direction, speed = 16, color = 'white', origin = 'player', size = 8, damage = 1) {
    return {
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        x: x * 32,
        y: y * 32,
        width: size, // Width of the bullet
        height: size, // Height of the bullet
        oldX: x,
        oldY: y,
        direction: direction, // Can be 'up', 'down', 'left', 'right'
        speed: speed, // Pixels per update
        damage: damage, // Damage dealt by the bullet
        origin: origin, // Origin of the bullet
        color: color, // Color of the bullet
        active: true, // Bullet is active until it goes off-screen or hits something
        layer: origin === "player" ? 2 : 2, // Set layer to 2 if origin is "player", otherwise default to 1
        type: 'bullet',

        update() {
            //this.oldX = this.x;
            //this.oldY = this.y;

            // Move the bullet based on direction
            switch (this.direction) {
                case 'north':
                case 'up': this.y -= this.speed; break;
                case 'south':
                case 'down': this.y += this.speed; break;
                case 'east':
                case 'left': this.x -= this.speed; break;
                case 'west':
                case 'right': this.x += this.speed; break;
            }
            //this.oldX = Math.floor(this.x / 32) * 32;
            //this.oldY = Math.floor(this.y / 32) * 32;
            //console.log('old:', this.oldX, this.oldY);
            //console.log('new:', this.x, this.y);

            // Deactivate bullet if it goes off-screen
            //if (this.x < 0 || this.x > this.canvas.width || this.y < 0 || this.y > this.canvas.height) {
            //    this.active = false;
            //}
        },

        draw() {
            if (this.active) {
                
                this.ctx.fillStyle = color;
                this.ctx.fillRect(this.x, this.y, 4, 4); // Draw a small square bullet
              
            }
        }
    };
}

export function deactivateAllBullets(bullets) {
    bullets.forEach(bullet => {
        bullet.active = false; // Deactivate the bullet
    });
    console.log('All bullets deactivated.');
}