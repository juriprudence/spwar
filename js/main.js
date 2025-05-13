// Game variables (initialized in init or by other modules)
let scene, camera, renderer;
let player; // Is the camera object
let playerHealth; // Initialized from PLAYER_HEALTH_INITIAL in init
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let bullets = [], enemies = [], walls = [];
let maze = []; // Populated by generateMaze() in maze.js
let playerVelocity = new THREE.Vector3();
let direction = new THREE.Vector3(); // For player movement calculation
let clock = new THREE.Clock();

// Mobile control variables (initialized/updated in ui.js)
let joystickActive = false;
let joystickDirection = new THREE.Vector2();
let turnJoystickDirection = new THREE.Vector2(); // For the turning joystick
let joystickKnob, joystick, joystickRect, shootButton; // DOM elements
// turnJoystickElement, turnJoystickKnobElement, turnJoystickRect are handled in ui.js

// Power-up related global variables
let powerUps = [];
let playerShieldMesh = null; // For the visual shield effect
let powerUpSpawnTimer = 0;
let playerSpeedBoostActive = false; // For visual effects like trails
let playerShieldActive = false;   // For damage reduction logic

// Player state variables that can be modified by power-ups
let currentPlayerSpeed; // Will be initialized from PLAYER_SPEED
// currentWeaponLevel is already in config.js
let currentLevel = 1; // Initial game level
let enemyProjectiles = []; // Array for enemy projectiles
let isPlayerDead = false; // Flag to track player's death state

// Initialize and start the game
// Ensure DOM is loaded before trying to get elements or add listeners that depend on DOM elements
document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});

function init() {
    playerHealth = PLAYER_HEALTH_INITIAL; // From config.js
    currentPlayerSpeed = PLAYER_SPEED; // Initialize current speed from config
    powerUpSpawnTimer = 0; // Initialize power-up spawn timer
    isPlayerDead = false; // Reset player death state on init

    // Define and assign effect functions to POWERUP_TYPES
    // This needs to be done after POWERUP_TYPES is loaded from config.js
    // but before any power-ups are created or their effects are called.
    // We'll do this here in init.
    if (typeof POWERUP_TYPES !== 'undefined') {
        POWERUP_TYPES.HEALTH.effect = (player) => {
            playerHealth = Math.min(playerHealth + 25, PLAYER_HEALTH_INITIAL);
            // Assuming updateScoreDisplay and showNotification are available globally or via ui.js
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay(50);
            // if (typeof showNotification === 'function') showNotification("Health +25!");
        };
        POWERUP_TYPES.SPEED.effect = (player) => {
            const originalSpeed = PLAYER_SPEED; // Base speed from config
            currentPlayerSpeed = originalSpeed * 1.5;
            playerSpeedBoostActive = true;
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay(25);
            // if (typeof showNotification === 'function') showNotification("Speed Boost!");
            setTimeout(() => {
                currentPlayerSpeed = originalSpeed;
                playerSpeedBoostActive = false;
            }, 10000); // 10 seconds
        };
        POWERUP_TYPES.WEAPON.effect = (player) => {
            if (currentWeaponLevel < WEAPON_TYPES.length - 1) {
                currentWeaponLevel++;
                // Assuming updateWeaponDisplay is available
                if (typeof updateWeaponDisplay === 'function') updateWeaponDisplay();
                
                // Reset weapon back to basic after some time (optional)
                if (currentWeaponLevel > 0) { // Don't reset if already at basic
                    if (window.weaponResetTimeout) {
                        clearTimeout(window.weaponResetTimeout);
                    }
                    
                    window.weaponResetTimeout = setTimeout(() => {
                        currentWeaponLevel = 0;
                        if (typeof updateWeaponDisplay === 'function') updateWeaponDisplay();
                        if (typeof showNotification === 'function') showNotification("Weapon Power-up Expired!");
                    }, 20000); // 20 seconds of upgraded weapon
                }
            }
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay(75);
            if (typeof showNotification === 'function') showNotification("Weapon Upgraded to " + WEAPON_TYPES[currentWeaponLevel].name + "!");
        };
        POWERUP_TYPES.SHIELD.effect = (player) => {
            playerShieldActive = true;
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay(100);
            createShieldEffect(); // From powerups.js
            // if (typeof showNotification === 'function') showNotification("Shield Activated!");
            setTimeout(() => {
                playerShieldActive = false;
                if (playerShieldMesh && player) { // playerShieldMesh is global
                    player.remove(playerShieldMesh); // Assuming it's child of player
                    playerShieldMesh = null;
                }
            }, 15000); // 15 seconds
        };
    }


    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR); // From config.js

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Eye level is set in config.js, player start position is calculated based on maze
    player = camera; // Player is the camera
    player.rotation.order = 'YXZ'; // Explicitly set Euler order for consistent FPS controls

    // Create renderer
    const gameCanvas = document.getElementById('gameCanvas');
    if (!gameCanvas) {
        console.error("gameCanvas not found!");
        return;
    }
    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040); // Consider moving color to config
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Consider moving color/intensity to config
    directionalLight.position.set(5, 10, 5); // Consider making position configurable
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Create floor
    // Increased size to ensure it covers the entire maze area and beyond.
    const floorDimension = MAZE_SIZE * 4;
    const floorGeometry = new THREE.PlaneGeometry(floorDimension, floorDimension); // From config.js
    
    const textureLoader = new THREE.TextureLoader();
    const floorTexture = textureLoader.load('texture/floor.jpeg',
        function (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            // The floor is MAZE_SIZE * 2 units wide/long.
            // If MAZE_SIZE is 15, floor is 30x30.
            // Let's assume the texture should repeat every 2 world units.
            // The new floorDimension is MAZE_SIZE * 4.
            const repeatValue = floorDimension / 2;
            texture.repeat.set(repeatValue, repeatValue);
            console.log(`Floor texture loaded. Dimension: ${floorDimension}, Repeat: ${repeatValue}`);
        },
        undefined,
        function (err) {
            console.error('An error happened while loading the floor texture:', err);
        }
    );

    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        color: 0xffffff // Use white to show texture purely, or FLOOR_COLOR to tint
        // roughness: 0.9, // Adjust as needed
        // metalness: 0.1  // Adjust as needed
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Maze generation and wall creation will be handled by multiplayer logic
    // generateMaze(); // Called by player 1 in multiplayer.js
    // createMazeWalls(); // Called after maze data is set (either locally for player 1 or via event for others)

    // Player initial position will be set by multiplayer logic after maze is ready (or for simple plane)
    // See setLocalPlayerInitialPosition() in player.js, called from multiplayer.js

    // Create enemies (from enemy.js)
    // createEnemies(ENEMY_COUNT); // ENEMY_COUNT from config.js // Temporarily disabled for multiplayer debugging

    // Setup UI elements and controls (from ui.js)
    if (typeof DRAW_MAZE !== 'undefined' && DRAW_MAZE) {
        // setupMiniMap(); // Minimap setup will be called from multiplayer.js after maze is ready
    } else {
        console.log("DRAW_MAZE is false. Skipping minimap setup. Using simple plane.");
    }
    setupMobileControls(); // This will also fetch joystick, joystickKnob, shootButton DOM elements
    setupFullscreenControls(); // Add call to setup fullscreen button
    
    // Initialize weapon display
    if (typeof updateWeaponDisplay === 'function') {
        updateWeaponDisplay();
    }
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize); // onWindowResize from ui.js
    document.addEventListener('keydown', onKeyDown);   // onKeyDown from player.js
    document.addEventListener('keyup', onKeyUp);     // onKeyUp from player.js

    // Mouse look and pointer lock
    gameCanvas.addEventListener('click', () => {
        if (!document.pointerLockElement && !document.mozPointerLockElement && !document.webkitPointerLockElement) {
            gameCanvas.requestPointerLock = gameCanvas.requestPointerLock ||
                                            gameCanvas.mozRequestPointerLock ||
                                            gameCanvas.webkitRequestPointerLock;
            if (gameCanvas.requestPointerLock) {
                gameCanvas.requestPointerLock();
            }
        }
    });

    function onPointerLockChange() {
        if (document.pointerLockElement === gameCanvas ||
            document.mozPointerLockElement === gameCanvas ||
            document.webkitPointerLockElement === gameCanvas) {
            // Pointer locked
            document.addEventListener("mousemove", handleMouseMove, false); // handleMouseMove from player.js
        } else {
            // Pointer unlocked
            document.removeEventListener("mousemove", handleMouseMove, false);
        }
    }

    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
    document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);

    // Desktop click to shoot (mobile uses touchstart on button)
    // This listener should only fire if pointer is locked or if it's not on a UI element.
    document.addEventListener('mousedown', (event) => { // Changed to mousedown for better FPS feel
        // Allow clicks on UI elements if pointer is not locked
        if (!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement)) {
            if ((joystick && joystick.contains(event.target)) ||
                (shootButton && shootButton.contains(event.target))) {
                return; // Don't shoot if clicking on joystick/shoot button when not locked
            }
            const gameOverScreen = document.getElementById('gameOverScreen');
            const restartButtonElem = document.getElementById('restartButton');
            if (gameOverScreen && gameOverScreen.style.display === 'flex' && restartButtonElem && restartButtonElem.contains(event.target)) {
                return; // Don't shoot if clicking restart button
            }
        }
        // If pointer is locked, or if it's a general click not on UI, then shoot.
        // The check for UI elements is more for when pointer isn't locked.
        // When pointer is locked, event.target might not be reliable.
         if ((document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement) ||
            !((joystick && joystick.contains(event.target)) || (shootButton && shootButton.contains(event.target)))) {
            // Use multiplayer shooting function instead of shoot()
            shootMultiplayer();
        }
    });
    
    // Initialize multiplayer
    initializeMultiplayer();
    
    // Initialize player list UI
    setupPlayerListUI();
    
    // Spawn an initial power-up so players can see it on the map
    setTimeout(() => {
        if (typeof spawnRandomPowerUp === 'function' && maze && maze.length > 0) {
            spawnRandomPowerUp();
        }
    }, 3000); // Give the maze time to generate
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Update game elements
    updatePlayer(delta);  // from player.js
    updateBullets(delta); // from bullet.js
    updateParticles(delta); // from bullet.js - particle system for bullet trails
    updateEnemies(delta); // from enemy.js
    updatePowerUps(delta); // from powerups.js
    powerUpSpawnTimer += delta; // Increment global timer used by powerups.js for bobbing
    updateEnemyProjectiles(delta); // from enemy_types.js (or wherever it's moved)
    
    // Update multiplayer components
    updateOtherPlayers(delta); // from multiplayer.js

    // MiniMap updates itself via requestAnimationFrame in ui.js

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}