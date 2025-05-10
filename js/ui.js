// UI related functions

function setupMiniMap() {
    const miniMapElement = document.getElementById('miniMap');
    if (!miniMapElement) return;

    const mapContext = document.createElement('canvas').getContext('2d');
    mapContext.canvas.width = 150; // Consider making these configurable
    mapContext.canvas.height = 150;

    miniMapElement.innerHTML = ''; // Clear previous map if any
    miniMapElement.appendChild(mapContext.canvas);

    function updateMiniMap() {
        if (!maze || maze.length === 0 || !player || !enemies || !mapContext) { // Check if globals are available and maze is populated
            requestAnimationFrame(updateMiniMap);
            return;
        }
        mapContext.fillStyle = 'black';
        mapContext.fillRect(0, 0, 150, 150);

        const actualGridSize = maze.length; // This is (2 * MAZE_SIZE + 1)
        const cellSize = 150 / actualGridSize;

        // Draw maze paths
        for (let i = 0; i < actualGridSize; i++) {
            for (let j = 0; j < actualGridSize; j++) {
                if (maze[i][j] === 0) { // 0 is path
                    mapContext.fillStyle = '#555';
                    mapContext.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                }
            }
        }
        
        // Helper to convert world coordinates to maze grid indices
        // World X/Z = (grid_idx * 2) - actualGridSize + 1
        // grid_idx * 2 = World_coord + actualGridSize - 1
        // grid_idx = (World_coord + actualGridSize - 1) / 2
        const worldToGrid = (worldCoord) => (worldCoord + actualGridSize - 1) / 2;

        // Draw enemies
        mapContext.fillStyle = 'red';
        enemies.forEach(enemy => {
            const gridX = worldToGrid(enemy.position.x);
            const gridZ = worldToGrid(enemy.position.z); // Z in world is Y on map
            mapContext.fillRect(gridX * cellSize - 2, gridZ * cellSize - 2, 4, 4);
        });

        // Draw player
        mapContext.fillStyle = 'blue';
        const playerGridX = worldToGrid(player.position.x);
        const playerGridZ = worldToGrid(player.position.z); // Z in world is Y on map
        mapContext.fillRect(playerGridX * cellSize - 3, playerGridZ * cellSize - 3, 6, 6);

        // Draw player direction
        mapContext.strokeStyle = 'white'; // Changed from fillStyle for line
        const dirX = Math.sin(player.rotation.y);
        const dirZ = Math.cos(player.rotation.y);
        mapContext.beginPath();
        mapContext.moveTo(playerGridX * cellSize, playerGridZ * cellSize);
        // For minimap: +X is right, +Y is down.
        // Player forward: -Z world. Player right: +X world.
        // Player rotation.y = 0 means facing -Z world. sin(0)=0, cos(0)=1.
        // Minimap line should go from playerGridPos towards (playerGridX - sin(rotY)*len, playerGridZ - cos(rotY)*len)
        mapContext.lineTo(
            (playerGridX - dirX * 0.5 / cellSize * 10) * cellSize, // 0.5 is arbitrary length factor for minimap
            (playerGridZ - dirZ * 0.5 / cellSize * 10) * cellSize  // dirZ is correct for Z-axis mapping to Y on map
        );
        mapContext.stroke();

        requestAnimationFrame(updateMiniMap);
    }
    updateMiniMap();
}


function setupMobileControls() {
    joystick = document.getElementById('joystick'); // joystick is global in main.js
    joystickKnob = document.getElementById('joystickKnob'); // joystickKnob is global in main.js
    shootButton = document.getElementById('shootButton'); // shootButton is global in main.js

    if (joystick) {
        joystick.addEventListener('touchstart', function(event) {
            event.preventDefault();
            joystickActive = true; // joystickActive is global in main.js
            joystickRect = joystick.getBoundingClientRect(); // joystickRect is global in main.js
            updateJoystickPosition(event.touches[0]);
        }, { passive: false }); // Explicitly non-passive

        document.addEventListener('touchmove', function(event) {
            if (joystickActive) {
                event.preventDefault();
                updateJoystickPosition(event.touches[0]);
            }
        }, { passive: false }); // Explicitly non-passive

        document.addEventListener('touchend', function(event) {
            // Check if the touchend originated from the joystick itself or is a general touchend
            let stillTouchingJoystick = false;
            if (event.touches) {
                for (let i = 0; i < event.touches.length; i++) {
                    if (event.touches[i].target === joystick || joystick.contains(event.touches[i].target)) {
                        stillTouchingJoystick = true;
                        break;
                    }
                }
            }
             if (!stillTouchingJoystick && event.target !== joystick && !joystick.contains(event.target)) {
                joystickActive = false;
                if(joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
                joystickDirection.set(0, 0); // joystickDirection is global in main.js
            }
        });
         // More specific touchend for joystick
        joystick.addEventListener('touchend', function(event) {
            event.preventDefault(); // Prevent click events after touch
            joystickActive = false;
            if(joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
            joystickDirection.set(0, 0);
        });
    }

    if (shootButton) {
        shootButton.addEventListener('touchstart', function(event) {
            event.preventDefault(); // Prevent click events after touch
            shoot(); // shoot from bullet.js
        }, { passive: false });
    }

    // Prevent default behavior for touch events on game container to avoid scrolling/zooming
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) {
        gameContainer.addEventListener('touchstart', function(event) {
            // Allow touch on specific controls like joystick and shoot button
            if (event.target !== joystick && !joystick.contains(event.target) &&
                event.target !== shootButton && !shootButton.contains(event.target)) {
                // event.preventDefault(); // This might be too aggressive, let's test
            }
        }, { passive: false });
    }
}

function updateJoystickPosition(touch) {
    if (!joystickRect || !joystickKnob) return; // joystickRect, joystickKnob are global

    const centerX = joystickRect.left + joystickRect.width / 2;
    const centerY = joystickRect.top + joystickRect.height / 2;

    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxRadius = joystickRect.width / 2;

    if (distance > maxRadius) {
        deltaX *= maxRadius / distance;
        deltaY *= maxRadius / distance;
    }

    joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    joystickDirection.x = deltaX / maxRadius; // joystickDirection is global
    joystickDirection.y = deltaY / maxRadius;
}

function gameOver() {
    const gameOverScreen = document.getElementById('gameOverScreen');
    const restartButton = document.getElementById('restartButton');

    if (gameOverScreen) gameOverScreen.style.display = 'flex';

    if (restartButton) {
        // Remove old listener to prevent multiple executions if gameOver is called multiple times
        const newRestartButton = restartButton.cloneNode(true);
        restartButton.parentNode.replaceChild(newRestartButton, restartButton);

        newRestartButton.addEventListener('click', function() {
            // Reset game state (playerHealth is global in main.js)
            playerHealth = PLAYER_HEALTH_INITIAL; // From config.js
            if (player) { // player is global in main.js
                 // Player starts at grid cell (1,1) of the 'maze' array.
                 // World X = (grid_i * 2) - actualGridSize + 1
                 const actualGridSizeForReset = 2 * MAZE_SIZE + 1; // MAZE_SIZE from config
                 const startX = 1 * 2 - actualGridSizeForReset + 1;
                 const startZ = 1 * 2 - actualGridSizeForReset + 1;
                 player.position.set(startX, PLAYER_EYE_LEVEL, startZ); // PLAYER_EYE_LEVEL from config.js
            }


            // Remove all enemies and bullets
            if (scene) { // scene is global
                enemies.forEach(enemy => scene.remove(enemy)); // enemies is global
                bullets.forEach(bullet => scene.remove(bullet)); // bullets is global
            }
            enemies.length = 0; // Clear arrays
            bullets.length = 0;

            // Create new enemies
            createEnemies(ENEMY_COUNT); // createEnemies from enemy.js, ENEMY_COUNT from config.js

            // Hide game over screen
            if (gameOverScreen) gameOverScreen.style.display = 'none';
        });
    }
}


function onWindowResize() {
    if (camera && renderer) { // camera, renderer are global in main.js
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    if (joystick) { // joystick is global
        joystickRect = joystick.getBoundingClientRect(); // joystickRect is global
    }
}
// window.addEventListener('resize', onWindowResize); // Listener will be added in main.js
// Placeholder for player list UI
function setupPlayerListUI() {
    console.log("setupPlayerListUI called");
    // TODO: Implement actual player list UI
    const playerListElement = document.getElementById('playerList');
    if (playerListElement) {
        // Basic placeholder content
        playerListElement.innerHTML = '&lt;h3&gt;Players&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;Player 1 (You)&lt;/li&gt;&lt;/ul&gt;';
    } else {
        console.warn("playerList element not found in HTML for setupPlayerListUI");
    }
}