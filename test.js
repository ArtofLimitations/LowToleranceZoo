function handleKeyboard(event) {
    const tileKey = `${currentLayer},${cursorX},${cursorY}`;

    switch (event.key) {

        case 'ArrowUp':
            if (cursorY > 0) cursorY -= 1; // Move up
            break;
        case 'ArrowDown':
            if (cursorY < tilesY - 1) cursorY += 1; // Move down
            break;
        case 'ArrowLeft':
            if (cursorX > 0) cursorX -= 1; // Move left
            break;
        case 'ArrowRight':
            if (cursorX < tilesX - 1) cursorX += 1; // Move right
            break;
        case ' ':
            if (placedSprites[tileKey]) {

                if (placedSprites[tileKey].type != 'player') delete placedSprites[tileKey]; // Remove sprite if it exists
            } else {
                // Place sprite
                placedSprites[tileKey] = {
                    sprite: currentSprite,    // add current selected sprite (number)
                    color: colors,            // add current colors from palette (array)
                    image: getSpriteImage(),  // add sprite image data
                    type: 'wall'              // default type is wall
                };
            };
            //drawBoard(); // Refresh board
            //drawSprites();
            break;
        case 'Enter': // add layers later
            grabSprite(tileKey);
            if (event.repeat) { return }
            break;
    }

    switch (event.key.toLowerCase()) {
        case 'e':
            removeMainEvents();
            editSprite(currentSprite); // Open the sprite editor from sprite-editor.js
            if (event.repeat) { return }
            break;
        case 'c':
            removeMainEvents();
            pickColor(); // Open color picker from palette.js
            if (event.repeat) { return }
            break;
        case '=':
            if (currentSprite < tileSetLength) currentSprite += 1; // iterate through sprite sheet
            console.log('current sprite: ' + currentSprite);
            updateSpriteData(currentSprite);
            break;
        case '-':
            if (currentSprite > 1) currentSprite -= 1;
            console.log('current sprite: ' + currentSprite);
            updateSpriteData(currentSprite);
            break;
        case 'b':
            if (!event.ctrlKey) saveBoard(placedSprites); // save board (not sprite sheet)
            if (event.repeat) { return }
            break;
        case 'o':
            editObject(); // open object script editor from object-editor.js
            if (event.repeat) { return }
            break;
        case '1':
            currentLayer = 1; // change layer for placing sprites
            if (event.repeat) { return }
            break;
        case '2':
            currentLayer = 2;
            if (event.repeat) { return }
            break;
        case '3':
            currentLayer = 3;
            if (event.repeat) { return }
            break;
        case 'h':
            if (hiddenLayers.has(currentLayer)) {
                showLayer(currentLayer);
                console.log('showing layer: ', currentLayer);
            }
            else {
                hideLayer(currentLayer);
                console.log('hiding layer: ', currentLayer);
            }
            if (event.repeat) { return }
    }

    if (event.ctrlKey || event.metaKey) {
        // Handle key combinations for both Windows/Linux (Ctrl) and Mac (Cmd)
        key.ctrl = true;
        switch (event.key.toLowerCase()) { // Check the key
            case "b": // Handle 'Ctrl + B' to load board (no sprite sheet)
                loadBoard(handleLoadedBoard);
                if (event.repeat) { return }
                break;
        }
    }
   
    console.log(event.key);
    
}

canvas.addEventListener('keydown', function (event) {
    const now = Date.now();
    console.log('now: ',now);
    if (now - key.lastClick > key.clickDelay); {
        console.log('yes');
        handleKeyboard(event);
    }
    console.log(now - key.lastClick);
    key.lastClick = now;
});