// Player related logic

function updatePlayer(delta) {
    if (isPlayerDead) { // isPlayerDead is global from main.js
        if (player && player.parent) { // Check if player (camera) is still in scene
            // scene.remove(player); // Removing the main camera might cause issues with rendering loop.
                                  // Instead, we can make it invisible or move it.
                                  // For simplicity, let's just stop updating and rely on gameOver screen.
            // player.visible = false; // Alternative: make player invisible
        }
        return; // Stop updating if player is dead
    }

    // Calculate velocity based on keys or joystick
    playerVelocity.x = 0; // playerVelocity is global in main.js
    playerVelocity.z = 0;

    if (moveForward || (joystickActive && joystickDirection.y < -JOYSTICK_MOVEMENT_THRESHOLD)) { // moveForward, joystickActive, joystickDirection from main.js; JOYSTICK_MOVEMENT_THRESHOLD from config.js
        playerVelocity.z = -currentPlayerSpeed * (joystickActive ? Math.abs(joystickDirection.y) : 1); // Use currentPlayerSpeed from main.js
    }
    if (moveBackward || (joystickActive && joystickDirection.y > JOYSTICK_MOVEMENT_THRESHOLD)) {
        playerVelocity.z = currentPlayerSpeed * (joystickActive ? joystickDirection.y : 1);
    }
    if (moveLeft || (joystickActive && joystickDirection.x < -JOYSTICK_MOVEMENT_THRESHOLD)) {
        playerVelocity.x = -currentPlayerSpeed * (joystickActive ? Math.abs(joystickDirection.x) : 1);
    }
    if (moveRight || (joystickActive && joystickDirection.x > JOYSTICK_MOVEMENT_THRESHOLD)) {
        playerVelocity.x = currentPlayerSpeed * (joystickActive ? joystickDirection.x : 1);
    }

    // Get movement in world coordinates (relative to player facing)
    direction.copy(playerVelocity); // direction is global in main.js
    direction.applyEuler(new THREE.Euler(0, player.rotation.y, 0)); // player is global in main.js

    // Mobile turning with the dedicated turn joystick
    // Assumes turnJoystickActive (from ui.js) and turnJoystickDirection (from main.js) are globally accessible
    // JOYSTICK_TURN_SENSITIVITY is from config.js
    if (typeof turnJoystickActive !== 'undefined' && turnJoystickActive &&
        typeof turnJoystickDirection !== 'undefined' &&
        !(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement)) {
        
        player.rotation.y -= turnJoystickDirection.x * delta * JOYSTICK_TURN_SENSITIVITY;

        // Optional: Implement pitch control with turnJoystickDirection.y if needed in the future
        // let currentPitch = player.rotation.x;
        // currentPitch -= turnJoystickDirection.y * delta * JOYSTICK_PITCH_SENSITIVITY; // Requires JOYSTICK_PITCH_SENSITIVITY in config
        // player.rotation.x = THREE.MathUtils.clamp(currentPitch, MIN_PITCH, MAX_PITCH); // Requires MIN_PITCH, MAX_PITCH in config
    }

    // Simple collision detection
    const nextPosition = player.position.clone().addScaledVector(direction, delta);

    // Check collision with walls
    let collision = false;
    for (const wall of walls) { // walls is global in main.js
        const dx = nextPosition.x - wall.position.x;
        const dz = nextPosition.z - wall.position.z;

        if (Math.abs(dx) < PLAYER_WALL_COLLISION_THRESHOLD && Math.abs(dz) < PLAYER_WALL_COLLISION_THRESHOLD) { // PLAYER_WALL_COLLISION_THRESHOLD from config.js
            collision = true;
            break;
        }
    }

    if (!collision) {
        player.position.addScaledVector(direction, delta);
    }

    // Update health bar (This might move to ui.js if health bar is managed there)
    // For now, assuming playerHealth is accessible (global in main.js)
    document.getElementById('healthFill').style.width = playerHealth + '%';

    // Check if player is dead
    if (playerHealth <= 0 && !isPlayerDead) { // Check !isPlayerDead to run this once
        isPlayerDead = true; // Set the flag
        console.log("Player has died.");
        // Player (camera) is not explicitly removed from scene here to avoid breaking renderer.
        // The game over screen will take over.
        // If a visual representation of the player existed beyond the camera, it would be removed here.
        gameOver(); // gameOver will be in ui.js or main.js
    }
}

function onKeyDown(event) { // moveForward etc are global in main.js
    if (isPlayerDead) return; // Ignore input if player is dead

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (!isPlayerDead) shootMultiplayer(); // shootMultiplayer from multiplayer.js (or shoot() if single player)
            break;
    }
}

function onKeyUp(event) { // moveForward etc are global in main.js
    if (isPlayerDead) return; // Ignore input if player is dead

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

// Mouse look handler
// Removed erroneous line: let_euler = new THREE.Euler(0, 0, 0, 'YXZ');
// player.rotation.order is set to 'YXZ' in main.js init()

function handleMouseMove(event) {
    if (isPlayerDead || !player || !(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement)) {
        return; // Only rotate if player not dead, pointer is locked and player exists
    }

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    // Yaw (horizontal rotation) - applied to the player/camera object directly
    player.rotation.y -= movementX * MOUSE_SENSITIVITY;

    // Pitch (vertical rotation) - applied to the camera's X rotation
    // We need to manage pitch carefully to avoid flipping over.
    // Instead of directly setting player.rotation.x, we'll manage it via an Euler angle
    // to ensure correct clamping and order of operations.
    
    // Apply pitch to a temporary Euler angle, then clamp it.
    // Note: player is the camera itself.
    // We want to rotate around the camera's local X-axis for pitch.
    // However, directly manipulating player.rotation.x can lead to issues if player.rotation.y is also changing.
    // A common approach is to manage pitch separately or use quaternions.
    // For simplicity with Euler angles, we can try:
    
    let currentPitch = player.rotation.x;
    currentPitch -= movementY * MOUSE_SENSITIVITY;
    player.rotation.x = THREE.MathUtils.clamp(currentPitch, MIN_PITCH, MAX_PITCH);

}


// Event listeners will be added in main.js or after DOM content is loaded.
// document.addEventListener('keydown', onKeyDown);
// document.addEventListener('keyup', onKeyUp);
// document.addEventListener('mousemove', handleMouseMove);
function setLocalPlayerInitialPosition() {
    if (!player) {
        console.error("setLocalPlayerInitialPosition: Player object not initialized.");
        return;
    }
    if (typeof MAZE_SIZE === 'undefined' || typeof PLAYER_EYE_LEVEL === 'undefined') { // MAZE_SIZE, PLAYER_EYE_LEVEL from config.js
        console.error("setLocalPlayerInitialPosition: MAZE_SIZE or PLAYER_EYE_LEVEL not defined. Ensure config.js is loaded.");
        // Fallback to a default position if config is not loaded, though this is not ideal.
        player.position.set(0, 1.6, 0); 
        return;
    }

    const actualGridSize = 2 * MAZE_SIZE + 1; // MAZE_SIZE from config.js
    const centerGridIdx = Math.floor(actualGridSize / 2);

    // Helper to convert grid index to world coordinate
    const gridToWorld = (gridIdx) => (gridIdx * 2) - actualGridSize + 1;

    let startX = gridToWorld(centerGridIdx); // Default to center (world 0,0)
    let startZ = gridToWorld(centerGridIdx); // Default to center (world 0,0)

    if (typeof localPlayerID !== 'undefined' && localPlayerID !== null) { // localPlayerID is global from multiplayer.js
        if (localPlayerID === 1) {
            // Player 1 (host or first player) spawns at the absolute center
            startX = gridToWorld(centerGridIdx);
            startZ = gridToWorld(centerGridIdx);
        } else if (localPlayerID === 2) {
            // Player 2 spawns at a predefined offset, e.g., world X = +4
            // This corresponds to grid index centerGridIdx + 2
            startX = gridToWorld(centerGridIdx + 2);
            startZ = gridToWorld(centerGridIdx); // Same Z as center
        } else if (localPlayerID === 3) {
            // Player 3 spawns at another offset, e.g., world X = -4
            startX = gridToWorld(centerGridIdx - 2);
            startZ = gridToWorld(centerGridIdx);
        } else if (localPlayerID === 4) {
            // Player 4 spawns at, e.g., world Z = +4
            startX = gridToWorld(centerGridIdx);
            startZ = gridToWorld(centerGridIdx + 2);
        }
        // Add more specific spawn points if more than 4 players are expected
        // or implement a more dynamic spawn point selection from a list of cleared areas.
    } else {
        console.warn("setLocalPlayerInitialPosition: localPlayerID not defined, defaulting to center spawn.");
    }
    
    // Ensure player is visible when position is set/reset
    // if (player) player.visible = true; // If we were making player invisible on death

    player.position.set(startX, PLAYER_EYE_LEVEL, startZ); // PLAYER_EYE_LEVEL from config.js
    console.log(`setLocalPlayerInitialPosition: Player ${localPlayerID} (grid center: ${centerGridIdx},${centerGridIdx}) spawned at world (x:${startX.toFixed(2)}, z:${startZ.toFixed(2)})`);
    isPlayerDead = false; // Also ensure player is not dead when position is reset
}