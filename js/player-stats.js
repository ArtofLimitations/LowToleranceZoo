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
    health: 100,
    attack: 10,
    defense: 5,
    speed: 5,
    level: 1,
    experience: 0,
    experienceToNextLevel: 100,
    gameOver: false,
    inventory: [],
    equipped: {
        weapon: null,
        armor: null
    },
    stats: {
        coins: 0,
        ammo: 0,
        score: 0,
        lives: 3,
        keys: 0
    }
};