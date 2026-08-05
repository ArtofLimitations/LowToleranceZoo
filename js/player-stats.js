export let defaultPlayerStats = {
    name: "Player",
    x: 10,
    y: 10,
    width: 32,
    height: 32,
    oldX: 10,
    oldY: 10,
    layer: 2,
    stepSize: 0.5,
    transported: false,
    locked: false,
    canShoot: true,
    maxBullets: 256,
    justInteracted: false,
    flashRed: false,
    flashTimer: 0,
    attack: 10,
    defense: 5,
    speed: 5,
    level: 1,
    experience: 0,
    experienceToNextLevel: 100,
    gameOver: false,
    // Player-specific weapon ownership and equipped state
    weapons: {
        owned: {
            // Weapon ID -> per-player data (e.g., ammo)
            pistol: { ammo: 24 }
        },
        equipped: "pistol" // Default selected weapon
    },

    inventory: [],
    equipped: {
        weapon: null,
        armor: null
    },
    stats: {
        health: 100,
        coin: 0,
        ammo: 0,
        score: 0,
        lives: 3,
        keys: 0
    }
};