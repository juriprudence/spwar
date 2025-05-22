// UI related functions

// Variables for the turning joystick (assuming turnJoystickDirection is initialized in main.js)
var turnJoystickElement;
var turnJoystickKnobElement;
var turnJoystickActive = false;
var turnJoystickRect;
// var turnJoystickDirection = new THREE.Vector2(); // Should be in main.js

let miniMapCanvasContext = null; // To store the minimap's 2D rendering context
let lastMiniMapWidth = 0;
let lastMiniMapHeight = 0;

function setupMiniMap() {
    const miniMapElement = document.getElementById('miniMap');
    if (!miniMapElement) {
        console.warn("miniMapElement not found for setup.");
        return;
    }

    // Ensure styles are applied before getting dimensions
    const computedStyle = getComputedStyle(miniMapElement);
    const newWidth = parseInt(computedStyle.width, 10);
    const newHeight = parseInt(computedStyle.height, 10);

    if (!miniMapCanvasContext) { // Create canvas only once
        const canvas = document.createElement('canvas');
        miniMapCanvasContext = canvas.getContext('2d');
        miniMapElement.innerHTML = ''; // Clear previous map if any
        miniMapElement.appendChild(canvas);
    }

    miniMapCanvasContext.canvas.width = newWidth;
    miniMapCanvasContext.canvas.height = newHeight;
    lastMiniMapWidth = newWidth;
    lastMiniMapHeight = newHeight;

    console.log(`Minimap canvas set to: ${newWidth}x${newHeight}`);

    // Create power-up legend
    createPowerUpLegend();

    function updateMiniMap() {
        // Check for otherPlayers global from multiplayer.js
        if (!maze || maze.length === 0 || !player || !enemies || !miniMapCanvasContext || typeof otherPlayers === 'undefined') {
            requestAnimationFrame(updateMiniMap);
            return;
        }
        // Use canvas dimensions for drawing
        const currentMapWidth = miniMapCanvasContext.canvas.width;
        const currentMapHeight = miniMapCanvasContext.canvas.height;

        miniMapCanvasContext.fillStyle = 'black';
        miniMapCanvasContext.fillRect(0, 0, currentMapWidth, currentMapHeight);

        const actualGridSize = maze.length;
        // Base cell size on the smaller dimension of the minimap to maintain aspect ratio
        const cellSize = Math.min(currentMapWidth, currentMapHeight) / actualGridSize;

        // Draw maze paths
        for (let i = 0; i < actualGridSize; i++) {
            for (let j = 0; j < actualGridSize; j++) {
                if (maze[i][j] === 0) { // 0 is path
                    miniMapCanvasContext.fillStyle = '#555';
                    miniMapCanvasContext.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                }
            }
        }
        
        const worldToGrid = (worldCoord) => (worldCoord + actualGridSize - 1) / 2;

        // Draw power-ups with their respective colors
        if (typeof powerUps !== 'undefined' && powerUps.length > 0) {
            powerUps.forEach(powerUp => {
                // Convert world coordinates to grid coordinates
                const gridX = worldToGrid(powerUp.position.x);
                const gridZ = worldToGrid(powerUp.position.z);
                
                // Set the color based on the power-up type
                if (powerUp.powerUpType && typeof powerUp.powerUpType.color !== 'undefined') {
                    // Convert the hex color to CSS color string
                    const hexColor = '#' + powerUp.powerUpType.color.toString(16).padStart(6, '0');
                    miniMapCanvasContext.fillStyle = hexColor;
                } else {
                    // Default color if type or color is not available
                    miniMapCanvasContext.fillStyle = '#ffffff'; // White as fallback
                }
                
                // Draw a diamond shape for power-ups to make them distinct
                miniMapCanvasContext.beginPath();
                miniMapCanvasContext.moveTo(gridX * cellSize, gridZ * cellSize - 3); // Top
                miniMapCanvasContext.lineTo(gridX * cellSize + 3, gridZ * cellSize); // Right
                miniMapCanvasContext.lineTo(gridX * cellSize, gridZ * cellSize + 3); // Bottom
                miniMapCanvasContext.lineTo(gridX * cellSize - 3, gridZ * cellSize); // Left
                miniMapCanvasContext.closePath();
                miniMapCanvasContext.fill();
            });
        }

        miniMapCanvasContext.fillStyle = 'red';
        enemies.forEach(enemy => {
            const gridX = worldToGrid(enemy.position.x);
            const gridZ = worldToGrid(enemy.position.z);
            miniMapCanvasContext.fillRect(gridX * cellSize - 2, gridZ * cellSize - 2, 4, 4);
        });

        miniMapCanvasContext.fillStyle = 'blue';
        const playerGridX = worldToGrid(player.position.x);
        const playerGridZ = worldToGrid(player.position.z);
        miniMapCanvasContext.fillRect(playerGridX * cellSize - 3, playerGridZ * cellSize - 3, 6, 6);

        // Draw other players
        // Assuming otherPlayers is a global object from multiplayer.js: { playerID: { model: { position, rotation }, targetPosition, targetRotationY, hp, color? } }
        // We'll use a default color for now, or try to get it from their model if available.
        miniMapCanvasContext.fillStyle = 'green'; // Default color for other players
        for (const id in otherPlayers) {
            const remotePlayer = otherPlayers[id];
            // Check if remote player is alive (hp > 0) before drawing
            if (remotePlayer && remotePlayer.model && remotePlayer.model.position && (typeof remotePlayer.hp === 'undefined' || remotePlayer.hp > 0)) {
                // Use the model's current interpolated position for smoother minimap representation
                const remotePlayerGridX = worldToGrid(remotePlayer.model.position.x);
                const remotePlayerGridZ = worldToGrid(remotePlayer.model.position.z);
                
                // Use a specific color if available, e.g., from remotePlayer.color or remotePlayer.model.material.color
                // For now, a fixed 'green' or slightly different size.
                miniMapCanvasContext.fillRect(remotePlayerGridX * cellSize - 2, remotePlayerGridZ * cellSize - 2, 5, 5); // Slightly different size/shape
            }
        }

        miniMapCanvasContext.strokeStyle = 'white';
        const dirX = Math.sin(player.rotation.y);
        const dirZ = Math.cos(player.rotation.y);
        miniMapCanvasContext.beginPath();
        miniMapCanvasContext.moveTo(playerGridX * cellSize, playerGridZ * cellSize);
        miniMapCanvasContext.lineTo(
            (playerGridX - dirX * 0.5 / cellSize * 10) * cellSize,
            (playerGridZ - dirZ * 0.5 / cellSize * 10) * cellSize
        );
        miniMapCanvasContext.stroke();

        requestAnimationFrame(updateMiniMap);
    }
    updateMiniMap();
}

// Create a legend for power-ups to show what each color represents
function createPowerUpLegend() {
    // Check if legend already exists
    let legendContainer = document.getElementById('powerUpLegend');
    if (legendContainer) {
        return; // Legend already exists
    }
    
    // Make sure UI container exists
    let uiContainer = document.querySelector('.ui-container');
    if (!uiContainer) {
        // Create the UI container if it doesn't exist (same as in createWeaponInfoDisplay)
        uiContainer = document.createElement('div');
        uiContainer.className = 'ui-container';
        document.body.appendChild(uiContainer);
        
        // Add basic styles for the UI container if not already added
        if (!document.querySelector('style[data-for="ui-container"]')) {
            const containerStyle = document.createElement('style');
            containerStyle.setAttribute('data-for', 'ui-container');
            containerStyle.textContent = `
                .ui-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 100;
                }
                .ui-container > * {
                    pointer-events: auto;
                }
            `;
            document.head.appendChild(containerStyle);
        }
    }
    
    // Create legend container
    legendContainer = document.createElement('div');
    legendContainer.id = 'powerUpLegend';
    legendContainer.className = 'power-up-legend';
    
    // Add title
    const title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Power-Ups';
    legendContainer.appendChild(title);
    
    // Add legend items
    if (typeof POWERUP_TYPES !== 'undefined') {
        for (const type in POWERUP_TYPES) {
            const powerUpType = POWERUP_TYPES[type];
            
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = '#' + powerUpType.color.toString(16).padStart(6, '0');
            
            const label = document.createElement('span');
            label.textContent = powerUpType.name;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            legendContainer.appendChild(legendItem);
        }
    }
    
    // Add to UI container
    uiContainer.appendChild(legendContainer);
    
    // Add styles for legend
    const style = document.createElement('style');
    style.textContent = `
        .power-up-legend {
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            border-radius: 5px;
            padding: 8px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            pointer-events: none;
            z-index: 150;
        }
        .legend-title {
            font-weight: bold;
            margin-bottom: 5px;
            text-align: center;
        }
        .legend-item {
            display: flex;
            align-items: center;
            margin: 3px 0;
        }
        .color-box {
            width: 10px;
            height: 10px;
            margin-right: 5px;
            border-radius: 2px;
        }
    `;
    document.head.appendChild(style);
}

function setupMobileControls() {
    joystick = document.getElementById('joystick'); // joystick is global in main.js
    joystickKnob = document.getElementById('joystickKnob'); // joystickKnob is global in main.js
    shootButton = document.getElementById('shootButton'); // shootButton is global in main.js

    // Initialize turn joystick elements
    turnJoystickElement = document.getElementById('turnJoystick');
    turnJoystickKnobElement = document.getElementById('turnJoystickKnob');

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

    if (turnJoystickElement) {
        turnJoystickElement.addEventListener('touchstart', function(event) {
            event.preventDefault();
            turnJoystickActive = true;
            turnJoystickRect = turnJoystickElement.getBoundingClientRect();
            updateTurnJoystickPosition(event.touches[0]);
        }, { passive: false });

        document.addEventListener('touchmove', function(event) {
            if (turnJoystickActive) {
                // Check if the touch is for the turn joystick
                // This simple check assumes one touch for movement and one for turning.
                // A more robust solution would track touch identifiers.
                for (let i = 0; i < event.touches.length; i++) {
                    const touch = event.touches[i];
                    if (touch.target === turnJoystickElement || turnJoystickElement.contains(touch.target)) {
                        event.preventDefault();
                        updateTurnJoystickPosition(touch);
                        break;
                    }
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', function(event) {
            let stillTouchingTurnJoystick = false;
            if (event.touches) {
                for (let i = 0; i < event.touches.length; i++) {
                    if (event.touches[i].target === turnJoystickElement || turnJoystickElement.contains(event.touches[i].target)) {
                        stillTouchingTurnJoystick = true;
                        break;
                    }
                }
            }
            // Check if the touchend originated from the turn joystick or related touches are gone
            let relevantTouchEnded = true;
            if (event.changedTouches) {
                relevantTouchEnded = false;
                for (let i = 0; i < event.changedTouches.length; i++) {
                    if (event.changedTouches[i].target === turnJoystickElement || turnJoystickElement.contains(event.changedTouches[i].target)) {
                        relevantTouchEnded = true;
                        break;
                    }
                }
            }

            if (!stillTouchingTurnJoystick && relevantTouchEnded) {
                 if (turnJoystickActive) { // Only reset if it was the active one
                    turnJoystickActive = false;
                    if(turnJoystickKnobElement) turnJoystickKnobElement.style.transform = 'translate(0px, 0px)';
                    if(turnJoystickDirection) turnJoystickDirection.set(0, 0); // turnJoystickDirection is global
                 }
            }
        });
        
        turnJoystickElement.addEventListener('touchend', function(event) {
            event.preventDefault();
            turnJoystickActive = false;
            if(turnJoystickKnobElement) turnJoystickKnobElement.style.transform = 'translate(0px, 0px)';
            if(turnJoystickDirection) turnJoystickDirection.set(0, 0);
        });
    }

    // Prevent default behavior for touch events on game container to avoid scrolling/zooming
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) {
        gameContainer.addEventListener('touchstart', function(event) {
            // Allow touch on specific controls
            if (event.target !== joystick && !joystick.contains(event.target) &&
                event.target !== shootButton && !shootButton.contains(event.target) &&
                event.target !== turnJoystickElement && !turnJoystickElement.contains(event.target) ) {
                // event.preventDefault(); // This might be too aggressive
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

function updateTurnJoystickPosition(touch) {
    if (!turnJoystickRect || !turnJoystickKnobElement || !turnJoystickDirection) return;

    const centerX = turnJoystickRect.left + turnJoystickRect.width / 2;
    const centerY = turnJoystickRect.top + turnJoystickRect.height / 2;

    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxRadius = turnJoystickRect.width / 2;

    if (distance > maxRadius) {
        deltaX *= maxRadius / distance;
        deltaY *= maxRadius / distance;
    }

    turnJoystickKnobElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    turnJoystickDirection.x = deltaX / maxRadius;
    turnJoystickDirection.y = deltaY / maxRadius; // Y might be used for pitch, or ignored
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
            isPlayerDead = false; // Reset player death state (isPlayerDead is global from main.js)
            
            // Ensure player (camera) is visible if it was hidden.
            // if (player && typeof player.visible !== 'undefined') {
            //     player.visible = true;
            // }


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
    if (turnJoystickElement) {
        turnJoystickRect = turnJoystickElement.getBoundingClientRect();
    }

    // Check and update minimap canvas size if necessary
    const miniMapElement = document.getElementById('miniMap');
    if (miniMapCanvasContext && miniMapElement) {
        const computedStyle = getComputedStyle(miniMapElement);
        const newWidth = parseInt(computedStyle.width, 10);
        const newHeight = parseInt(computedStyle.height, 10);

        if (newWidth !== lastMiniMapWidth || newHeight !== lastMiniMapHeight) {
            console.log(`Resizing minimap canvas to: ${newWidth}x${newHeight}`);
            miniMapCanvasContext.canvas.width = newWidth;
            miniMapCanvasContext.canvas.height = newHeight;
            lastMiniMapWidth = newWidth;
            lastMiniMapHeight = newHeight;
            // The updateMiniMap loop will pick up the new size on its next frame
        }
    }
}

function setupFullscreenControls() {
    const fullscreenButton = document.getElementById('fullscreenButton');
    if (!fullscreenButton) {
        console.warn("fullscreenButton element not found in HTML.");
        return;
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            // Enter fullscreen
            const element = document.documentElement; // Fullscreen the whole page
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.mozRequestFullScreen) { /* Firefox */
                element.mozRequestFullScreen();
            } else if (element.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
                element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) { /* IE/Edge */
                element.msRequestFullscreen();
            }

            // Attempt to lock orientation to landscape
            if (screen.orientation && typeof screen.orientation.lock === 'function') {
                screen.orientation.lock('landscape').catch(function(error) {
                    console.warn('Screen orientation lock failed:', error);
                });
            } else {
                console.warn('Screen orientation lock API not supported.');
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) { /* Firefox */
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) { /* Chrome, Safari & Opera */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE/Edge */
                document.msExitFullscreen();
            }
            // Unlocking orientation is usually handled by the browser when exiting fullscreen
        }
    }

    fullscreenButton.addEventListener('click', toggleFullscreen);
    fullscreenButton.addEventListener('touchstart', (event) => {
        event.preventDefault(); // Prevent click event from firing too
        toggleFullscreen();
    }, { passive: false });

    function updateFullscreenButtonText() {
        if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            fullscreenButton.textContent = 'EXIT FULLSCREEN';
        } else {
            fullscreenButton.textContent = 'FULLSCREEN';
        }
    }

    // Update button text on fullscreen change
    document.addEventListener('fullscreenchange', updateFullscreenButtonText);
    document.addEventListener('mozfullscreenchange', updateFullscreenButtonText);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtonText);
    document.addEventListener('msfullscreenchange', updateFullscreenButtonText);

    // Initial button text
    updateFullscreenButtonText();
}
// window.addEventListener('resize', onWindowResize); // Listener will be added in main.js
// Function to update the player list UI
function setupPlayerListUI() {
    const playerListItems = document.getElementById('playerListItems');
    if (!playerListItems) {
        console.error('playerListItems element not found in HTML');
        return;
    }

    // Initial update
    updatePlayerList();

    // Update every second
    setInterval(updatePlayerList, 1000);
}

function updatePlayerList() {
    const playerListItems = document.getElementById('playerListItems');
    if (!playerListItems) return;

    // Clear current list
    playerListItems.innerHTML = '';

    // Add local player
    const localPlayerDiv = document.createElement('div');
    localPlayerDiv.className = 'playerListItem localPlayer';
    localPlayerDiv.textContent = `You (HP: ${Math.max(0, Math.round(playerHealth))}%)`;
    playerListItems.appendChild(localPlayerDiv);

    // Add other players
    if (typeof otherPlayers === 'object') {
        for (const playerID in otherPlayers) {
            const player = otherPlayers[playerID];
            if (player) {
                const playerDiv = document.createElement('div');
                playerDiv.className = 'playerListItem';
                const hp = player.hp !== undefined ? Math.max(0, Math.round(player.hp)) : '?';
                playerDiv.textContent = `Player ${playerID} (HP: ${hp}%)`;
                playerListItems.appendChild(playerDiv);
            }
        }
    }
}

// Export the function for use in main.js
window.setupPlayerListUI = setupPlayerListUI;
window.updatePlayerList = updatePlayerList;

// Function to update the weapon display
function updateWeaponDisplay() {
    const weaponInfo = document.getElementById('weaponInfo');
    if (!weaponInfo) {
        // Create the weapon info display if it doesn't exist
        createWeaponInfoDisplay();
        return updateWeaponDisplay(); // Call again after creating
    }
    
    const currentWeapon = WEAPON_TYPES[currentWeaponLevel];
    weaponInfo.innerHTML = `
        <div class="weapon-name">${currentWeapon.name}</div>
        <div class="weapon-stats">
            <span>DMG: ${currentWeapon.damage}</span>
            <span>ROF: ${Math.round(1/currentWeapon.fireRate)}/s</span>
        </div>
    `;
    
    // Apply color based on weapon type
    weaponInfo.style.borderColor = '#' + currentWeapon.projectileColor.toString(16).padStart(6, '0');
}

// Create the weapon info display
function createWeaponInfoDisplay() {
    let uiContainer = document.querySelector('.ui-container');
    
    // Create the UI container if it doesn't exist
    if (!uiContainer) {
        console.log("UI container not found, creating one");
        uiContainer = document.createElement('div');
        uiContainer.className = 'ui-container';
        document.body.appendChild(uiContainer);
        
        // Add basic styles for the UI container
        const containerStyle = document.createElement('style');
        containerStyle.textContent = `
            .ui-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 100;
            }
            .ui-container > * {
                pointer-events: auto;
            }
        `;
        document.head.appendChild(containerStyle);
    }
    
    const weaponInfo = document.createElement('div');
    weaponInfo.id = 'weaponInfo';
    weaponInfo.className = 'weapon-info';
    uiContainer.appendChild(weaponInfo);
    
    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
        .weapon-info {
            position: absolute;
            bottom: 80px;
            right: 20px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            border-left: 4px solid #ffff00;
            pointer-events: none;
        }
        .weapon-name {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 4px;
        }
        .weapon-stats {
            font-size: 12px;
            display: flex;
            justify-content: space-between;
        }
        .weapon-stats span {
            margin-right: 10px;
        }
    `;
    document.head.appendChild(style);
}

// Function to show notifications
function showNotification(message, duration = 3000) {
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        // Create container if it doesn't exist
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.style.position = 'absolute';
        notificationContainer.style.top = '60px';
        notificationContainer.style.left = '50%';
        notificationContainer.style.transform = 'translateX(-50%)';
        notificationContainer.style.zIndex = '1000';
        document.body.appendChild(notificationContainer);
    }

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = message;
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '8px 16px';
    notification.style.borderRadius = '4px';
    notification.style.marginBottom = '8px';
    notification.style.textAlign = 'center';
    notification.style.animation = 'fadeInOut 3s forwards';
    
    // Add animation styles if not already present
    if (!document.getElementById('notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(-20px); }
                10% { opacity: 1; transform: translateY(0); }
                80% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    notificationContainer.appendChild(notification);
    
    // Remove notification after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, duration);
}

// Create the weapon selector UI
function createWeaponSelector() {
    let uiContainer = document.querySelector('.ui-container');
    
    // Create the UI container if it doesn't exist
    if (!uiContainer) {
        uiContainer = document.createElement('div');
        uiContainer.className = 'ui-container';
        document.body.appendChild(uiContainer);
    }
    
    const weaponSelector = document.createElement('div');
    weaponSelector.id = 'weaponSelector';
    weaponSelector.className = 'weapon-selector';
    uiContainer.appendChild(weaponSelector);
    
    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
        .weapon-selector {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 8px;
            pointer-events: auto;
        }
        .weapon-option {
            width: 60px;
            height: 60px;
            background-color: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: white;
            font-size: 12px;
            text-align: center;
            padding: 5px;
        }
        .weapon-option:hover {
            background-color: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }
        .weapon-option.active {
            border-color: #ffff00;
            background-color: rgba(255, 255, 0, 0.2);
        }
        .weapon-icon {
            width: 30px;
            height: 30px;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .weapon-name {
            font-size: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }
    `;
    document.head.appendChild(style);
    
    // Create weapon options
    WEAPON_TYPES.forEach((weapon, index) => {
        const option = document.createElement('div');
        option.className = 'weapon-option';
        option.dataset.weaponIndex = index;
        
        // Create icon based on weapon type
        const icon = document.createElement('div');
        icon.className = 'weapon-icon';
        switch(weapon.bulletType) {
            case 'single':
                icon.textContent = '🔫';
                break;
            case 'spread':
                icon.textContent = '🔫🔫🔫';
                break;
            case 'laser':
                icon.textContent = '⚡';
                break;
            case 'rocket':
                icon.textContent = '🚀';
                break;
            default:
                icon.textContent = '🔫';
        }
        
        const name = document.createElement('div');
        name.className = 'weapon-name';
        name.textContent = weapon.name;
        
        option.appendChild(icon);
        option.appendChild(name);
        
        // Add click handler
        option.addEventListener('click', () => {
            if (currentWeaponLevel !== index) {
                currentWeaponLevel = index;
                updateWeaponSelector();
                updateWeaponDisplay();
                if (typeof playSound === 'function') {
                    playSound('weapon_switch');
                }
            }
        });
        
        weaponSelector.appendChild(option);
    });
    
    // Initial update
    updateWeaponSelector();
}

// Update the weapon selector UI
function updateWeaponSelector() {
    const weaponSelector = document.getElementById('weaponSelector');
    if (!weaponSelector) return;
    
    const options = weaponSelector.querySelectorAll('.weapon-option');
    options.forEach((option, index) => {
        if (index === currentWeaponLevel) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// Export the new functions
window.createWeaponSelector = createWeaponSelector;
window.updateWeaponSelector = updateWeaponSelector;