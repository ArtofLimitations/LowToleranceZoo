function processObjectScripts() {
    for (let key in placedObjects) {
        let obj = placedObjects[key];

        // Reduce timer and check if it's time to process
        obj.timer--;
        if (obj.timer > 0) continue;
        obj.timer = obj.speed;  // Reset timer to object's speed

        // Get the current command
        let command = obj.script[obj.scriptIndex].trim().split(" ");
        let action = command[0];
        let args = command.slice(1);

        // Execute the command
        executeObjectCommand(obj, action, args);

        // Move to the next command
        obj.scriptIndex++;

        // If at end, loop back if `#loop` exists
        if (obj.scriptIndex >= obj.script.length) {
            obj.scriptIndex = obj.script.includes("#loop") ? 0 : obj.script.length - 1;
        }
    }
}

function parseScriptFromTextarea(text) {
    let lines = text.trim().split("\n").map(line => line.trim());
    let script = [];
    let collectingText = false;
    let textBlock = "";

    for (let line of lines) {
        if (line === "#text") {
            collectingText = true;
            textBlock = "";
            continue;
        } 
        
        if (collectingText) {
            if (line === "#end") {
                script.push(`#text ${textBlock.trim()}`); // Store full text block as one entry
                collectingText = false;
            } else {
                textBlock += line + "\n"; // Keep collecting multi-line text
            }
            continue;
        }

        // Store regular commands or section headers
        if (line !== "") {
            script.push(line);
        }
    }

    return script;
}

function executeObjectCommand(obj, action, args) {
    switch (action) {
        case "@name":
            obj.name = args.join(" ");
            break;
        case "#touch":
            obj.triggerOnTouch = true;  // Will check for touch events elsewhere
            break;
        case "#shot":
            obj.triggerOnShot = true;  // Will check for shooting events
            break;
        case "#change":
            obj.sprite = parseInt(args[0]);
            obj.color = args[1];
            break;
        case "#move":
            moveObject(obj, args[0]);
            break;
        case "#wait":
            obj.timer += parseInt(args[0]); // Delay execution
            break;
    }
}

function moveObject(obj, direction) {
    let [x, y] = key.split(",").map(Number);

    switch (direction) {
        case "up": y -= 1; break;
        case "down": y += 1; break;
        case "left": x -= 1; break;
        case "right": x += 1; break;
    }

    // Update object's position in `placedObjects`
    let newKey = `${x},${y}`;
    if (!placedObjects[newKey]) {  // Ensure not moving into another object
        delete placedObjects[key];
        placedObjects[newKey] = obj;
    }
}
