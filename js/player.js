// Player related logic

function updatePlayer(delta) {
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

    // Mobile turning (based on joystick x-axis) - only if joystick is active and mouse is not locked
    if (joystickActive && !(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement)) {
        player.rotation.y -= joystickDirection.x * delta * JOYSTICK_TURN_SENSITIVITY; // JOYSTICK_TURN_SENSITIVITY from config.js
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
    if (playerHealth <= 0) {
        gameOver(); // gameOver will be in ui.js or main.js
    }
}

function onKeyDown(event) { // moveForward etc are global in main.js
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
            shoot(); // shoot will be in bullet.js
            break;
    }
}

function onKeyUp(event) { // moveForward etc are global in main.js
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
let_euler = new THREE.Euler(0, 0, 0, 'YXZ'); // To control rotation order and avoid gimbal lock for camera

function handleMouseMove(event) {
    if (!player || !(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement)) {
        return; // Only rotate if pointer is locked and player exists
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
    if (!player) { // player is global from main.js
        console.error("setLocalPlayerInitialPosition: Player object not initialized.");
        return;
    }
    if (typeof MAZE_SIZE === 'undefined' || typeof PLAYER_EYE_LEVEL === 'undefined') { // MAZE_SIZE, PLAYER_EYE_LEVEL from config.js
        console.error("setLocalPlayerInitialPosition: MAZE_SIZE or PLAYER_EYE_LEVEL not defined. Ensure config.js is loaded.");
        // Fallback to a default position if config is not loaded, though this is not ideal.
        player.position.set(0, 1.6, 0); 
        return;
    }

    // Simplified spawning for flat plane testing
    let startX = 0;
    let startZ = 0;

    if (typeof localPlayerID !== 'undefined' && localPlayerID !== null) { // localPlayerID is global from multiplayer.js
        if (localPlayerID === 1) {
            startX = 0; // Player 1 at (0,0)
            startZ = 0;
        } else {
            startX = 5; // Other players at (5,0) for differentiation
            startZ = 0;
        }
    } else {
        console.warn("setLocalPlayerInitialPosition: localPlayerID not defined, defaulting to (0,0)");
    }

    player.position.set(startX, PLAYER_EYE_LEVEL, startZ); // PLAYER_EYE_LEVEL from config.js
    console.log(`setLocalPlayerInitialPosition: Player ${localPlayerID} position set to x:${startX}, y:${PLAYER_EYE_LEVEL}, z:${startZ}`);
}