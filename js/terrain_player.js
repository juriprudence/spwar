// Enhanced player controller for terrain movement
// This overrides the original player controls to handle terrain heights

// Save reference to original functions if they exist
const originalUpdatePlayer = window.updatePlayer;
const originalSetLocalPlayerInitialPosition = window.setLocalPlayerInitialPosition;

// Ray casting for ground detection
const groundRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
const upVector = new THREE.Vector3(0, 1, 0);
const tempPlayerPosition = new THREE.Vector3();
const GROUND_OFFSET = 1.5; // Height above ground to maintain (increased for better visibility)
const MAX_STEP_HEIGHT = 1.0; // Maximum height for a "step" the player can climb (increased)
const GRAVITY = 9.8; // Gravity force
let verticalVelocity = 0;
let isGrounded = true;

// Override the updatePlayer function to handle terrain heights
window.updatePlayer = function(delta) {
    if (typeof isPlayerDead !== 'undefined' && isPlayerDead) return;
    
    // Calculate base movement (similar to original)
    const speedFactor = (typeof currentPlayerSpeed !== 'undefined' ? currentPlayerSpeed : 5) * delta;
    const actualMoveSpeed = speedFactor;
    
    // Store original position for collision detection
    const originalPosition = new THREE.Vector3().copy(player.position);
    
    // Mobile movement using joystick
    if (typeof joystickActive !== 'undefined' && joystickActive && typeof joystickDirection !== 'undefined' && joystickDirection.length() > 0.1) {
        // Convert joystick direction to 3D movement direction
        const angle = player.rotation.y;
        const moveX = joystickDirection.x * Math.cos(angle) - joystickDirection.y * Math.sin(angle);
        const moveZ = joystickDirection.x * Math.sin(angle) + joystickDirection.y * Math.cos(angle);
        
        player.position.x += moveX * actualMoveSpeed;
        player.position.z += moveZ * actualMoveSpeed;
        
        // Create movement dust particles
        if (typeof createPlayerMovementDust === 'function' && isGrounded) {
            // Throttle the dust effect
            const currentTime = Date.now();
            if (!window.lastDustTime || currentTime - window.lastDustTime > 200) {
                window.lastDustTime = currentTime;
                createPlayerMovementDust(player.position, 0xd2b48c);
            }
        }
    }
    
    // Keyboard movement
    if (typeof direction !== 'undefined' && typeof moveForward !== 'undefined') {
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // Normalize for consistent movement speed in all directions
        
        if (moveForward || moveBackward) player.position.z -= direction.z * actualMoveSpeed;
        if (moveLeft || moveRight) player.position.x -= direction.x * actualMoveSpeed;
        
        // Handle dust particles for keyboard movement too
        if ((moveForward || moveBackward || moveLeft || moveRight) && typeof createPlayerMovementDust === 'function' && isGrounded) {
            const currentTime = Date.now();
            if (!window.lastDustTime || currentTime - window.lastDustTime > 200) {
                window.lastDustTime = currentTime;
                createPlayerMovementDust(player.position, 0xd2b48c);
            }
        }
    }
    
    // TERRAIN HEIGHT HANDLING
    if (!walls || !player) {
        console.error("Missing 'walls' array or 'player' object. Cannot perform terrain handling.");
        return;
    }
    
    // Try to find the terrain floor directly
    let terrainFloor = null;
    for (let i = 0; i < walls.length; i++) {
        if (walls[i].geometry && walls[i].geometry.type === 'PlaneGeometry' && 
            walls[i].rotation && Math.abs(walls[i].rotation.x + Math.PI/2) < 0.1) {
            terrainFloor = walls[i];
            break;
        }
    }
    
    // Use raycasting to find the ground beneath the player
    groundRaycaster.set(
        new THREE.Vector3(player.position.x, player.position.y + 10, player.position.z),
        downVector
    );
    
    // Collect all potential ground objects
    const groundObjects = [];
    
    // Add floor mesh(es)
    walls.forEach(wall => {
        // Only include floor-like objects (not vertical walls)
        if (wall.geometry && 
            (wall.geometry.type === 'PlaneGeometry' || 
             wall === terrainFloor)) {
            groundObjects.push(wall);
        }
    });
    
    // If we have no ground objects, add all objects (fallback)
    if (groundObjects.length === 0) {
        console.warn("No suitable floor objects found. Using all objects for raycasting.");
        walls.forEach(wall => {
            groundObjects.push(wall);
        });
    }
    
    const intersects = groundRaycaster.intersectObjects(groundObjects);
    
    // Debug raycast results
    if (intersects.length === 0) {
        console.warn("No ground intersection found. Player position:", player.position);
    }
    
    // Check if we found ground beneath us
    if (intersects.length > 0) {
        const groundPoint = intersects[0].point;
        
        // Calculate the desired height above ground
        const desiredHeight = groundPoint.y + GROUND_OFFSET;
        
        // Check if we need to step up or down
        const heightDifference = desiredHeight - player.position.y;
        
        if (heightDifference > 0) {
            // Stepping up
            if (heightDifference <= MAX_STEP_HEIGHT) {
                // Can step up
                player.position.y = desiredHeight;
                verticalVelocity = 0;
                isGrounded = true;
            } else {
                // Too high to step up, apply gravity
                verticalVelocity -= GRAVITY * delta;
                player.position.y += verticalVelocity * delta;
                isGrounded = false;
            }
        } else {
            // Stepping down or on level ground
            if (Math.abs(heightDifference) <= MAX_STEP_HEIGHT) {
                // Small step down, just adjust height
                player.position.y = desiredHeight;
                verticalVelocity = 0;
                isGrounded = true;
            } else {
                // Falling
                verticalVelocity -= GRAVITY * delta;
                player.position.y += verticalVelocity * delta;
                
                // Check if we've now reached the ground
                if (player.position.y <= desiredHeight) {
                    player.position.y = desiredHeight;
                    verticalVelocity = 0;
                    isGrounded = true;
                } else {
                    isGrounded = false;
                }
            }
        }
    } else {
        // No ground found, apply gravity
        verticalVelocity -= GRAVITY * delta;
        player.position.y += verticalVelocity * delta;
        isGrounded = false;
        
        // Safety check - if player falls too far, reset position
        if (player.position.y < -20) {
            setLocalPlayerInitialPosition();
            verticalVelocity = 0;
        }
    }
    
    // COLLISION DETECTION with maze walls - only detect collisions with non-floor objects
    for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        
        // Skip non-mesh objects or floor planes
        if (!wall.geometry || 
            wall.geometry.type === 'PlaneGeometry' || 
            (wall.rotation && Math.abs(wall.rotation.x + Math.PI/2) < 0.1)) {
            continue;
        }
        
        // Simple collision detection using bounding boxes
        const wallBox = new THREE.Box3().setFromObject(wall);
        const playerBox = new THREE.Box3();
        
        // Create player bounding box (adjust for character dimensions)
        const playerSize = 0.5; // Half-width of player collision box
        playerBox.min.set(
            player.position.x - playerSize,
            player.position.y - playerSize * 2, // Lower box to account for player height
            player.position.z - playerSize
        );
        playerBox.max.set(
            player.position.x + playerSize,
            player.position.y + playerSize, // Upper bound
            player.position.z + playerSize
        );
        
        // Check for collision
        if (playerBox.intersectsBox(wallBox)) {
            // Collision detected, revert to original position
            player.position.copy(originalPosition);
            break;
        }
    }
    
    // Broadcast position if in multiplayer
    if (typeof broadcastPlayerState === 'function' && typeof photon !== 'undefined' && photon.isJoinedToRoom()) {
        // We're updating position, so better broadcast it
        broadcastPlayerState();
    }
    
    // Call original function if it exists (to maintain any other functionality)
    if (originalUpdatePlayer && typeof originalUpdatePlayer === 'function') {
        try {
            // Temporarily disable the original function to avoid double-processing
            const temp = window.updatePlayer;
            window.updatePlayer = function() {}; // Dummy function
            originalUpdatePlayer(delta);
            window.updatePlayer = temp; // Restore our function
        } catch (e) {
            // Error in original function, this is fine, continue with our implementation
            console.warn("Error in original updatePlayer function:", e);
        }
    }
};

// Override the setLocalPlayerInitialPosition function
window.setLocalPlayerInitialPosition = function() {
    // Start with original function if available
    if (originalSetLocalPlayerInitialPosition && typeof originalSetLocalPlayerInitialPosition === 'function') {
        try {
            // Temporarily disable the overridden function to avoid infinite recursion
            const temp = window.setLocalPlayerInitialPosition;
            window.setLocalPlayerInitialPosition = function() {}; // Dummy function
            originalSetLocalPlayerInitialPosition();
            window.setLocalPlayerInitialPosition = temp; // Restore our function
        } catch (e) {
            // Error in original function, fallback to default implementation
            console.warn("Error in original setLocalPlayerInitialPosition function:", e);
            // Default implementation
            if (typeof maze !== 'undefined' && maze.length > 0) {
                const centerIdx = Math.floor(maze.length / 2);
                player.position.set(0, 5, 0); // Higher initial position to allow for raycast
            }
        }
    } else {
        // Default implementation if original function is unavailable
        if (typeof maze !== 'undefined' && maze.length > 0) {
            const centerIdx = Math.floor(maze.length / 2);
            player.position.set(0, 5, 0); // Higher initial position
        }
    }
    
    // Wait a short time for the terrain to fully initialize before adjusting height
    setTimeout(() => {
        adjustPlayerHeightToTerrain();
    }, 500);
    
    // Reset vertical velocity
    verticalVelocity = 0;
    isGrounded = true;
    
    console.log("Terrain-aware player position set:", player.position);
};

// Helper function to adjust player height to terrain
function adjustPlayerHeightToTerrain() {
    if (!player || !walls) {
        console.warn("Missing player or walls objects. Cannot adjust height.");
        return;
    }
    
    // Now perform terrain height adjustment
    // Use raycasting to find the ground beneath the initial position
    groundRaycaster.set(
        new THREE.Vector3(player.position.x, player.position.y + 10, player.position.z),
        downVector
    );
    
    // Collect floor objects
    const groundObjects = [];
    walls.forEach(wall => {
        if (wall.geometry && 
            (wall.geometry.type === 'PlaneGeometry' || 
             (wall.rotation && Math.abs(wall.rotation.x + Math.PI/2) < 0.1))) {
            groundObjects.push(wall);
        }
    });
    
    // If we have no ground objects, use all objects
    if (groundObjects.length === 0) {
        walls.forEach(wall => {
            groundObjects.push(wall);
        });
    }
    
    const intersects = groundRaycaster.intersectObjects(groundObjects);
    
    // Adjust player height based on terrain
    if (intersects.length > 0) {
        const groundPoint = intersects[0].point;
        player.position.y = groundPoint.y + GROUND_OFFSET;
        console.log("Player height adjusted to terrain:", player.position.y);
    } else {
        console.warn("No terrain found below player during height adjustment!");
    }
}

// Initialize on script load
console.log("Improved terrain-aware player controller initialized. Players will now follow terrain heights.");

// Keyboard and Mouse Input Handlers (copied from original player.js)
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

function handleMouseMove(event) {
    if (isPlayerDead || !player || !(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement)) {
        return; // Only rotate if player not dead, pointer is locked and player exists
    }

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    // Yaw (horizontal rotation) - applied to the player/camera object directly
    player.rotation.y -= movementX * MOUSE_SENSITIVITY; // MOUSE_SENSITIVITY from config.js

    // Pitch (vertical rotation) - applied to the camera's X rotation
    let currentPitch = player.rotation.x;
    currentPitch -= movementY * MOUSE_SENSITIVITY;
    player.rotation.x = THREE.MathUtils.clamp(currentPitch, MIN_PITCH, MAX_PITCH); // MIN_PITCH, MAX_PITCH from config.js

} 