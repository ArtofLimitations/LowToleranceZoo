const animations = [];

export function startTileAnimation(x, y, layer, frames, speed, onComplete) {
    animations.push({
        x, y, layer,
        frames,
        currentFrame: 0,
        speed,
        startTime: performance.now(),
        onComplete
    });
}

export function updateAnimations() {
    const now = performance.now();

    animations.forEach((anim, index) => {
        const elapsed = now - anim.startTime;

        if (elapsed > anim.speed * (anim.currentFrame + 1)) {
            anim.currentFrame++;

            if (anim.currentFrame >= anim.frames.length) {
                // Animation finished
                if (anim.onComplete) anim.onComplete();
                animations.splice(index, 1); // Remove animation
            } else {
                // Update tile to the next frame
                const tileKey = `${anim.layer},${anim.x},${anim.y}`;
                if (placedSprites[tileKey]) {
                    placedSprites[tileKey].sprite = anim.frames[anim.currentFrame];
                    updateTile(anim.layer, anim.x, anim.y);
                }
            }
        }
    });
}
