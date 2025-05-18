// Game variables (initialized in init or by other modules)let scene, camera, renderer;let composer; // For post-processinglet bloomPass; // For glow effectlet player; // Is the camera objectlet playerSpotlight; // Spotlight attached to playerlet playerHealth; // Initialized from PLAYER_HEALTH_INITIAL in init// Loading trackinglet totalAssets = 0;let loadedAssets = 0;let loadingScreen;let loadingBar;let loadingText;function updateLoadingProgress(message) {    if (!loadingBar || !loadingText) return;        loadedAssets++;    const progress = (loadedAssets / totalAssets) * 100;    loadingBar.style.width = `${progress}%`;    loadingText.textContent = message || `Loading... ${Math.round(progress)}%`;        // Hide loading screen when everything is loaded    if (loadedAssets >= totalAssets) {        setTimeout(() => {            loadingScreen.style.opacity = '0';            setTimeout(() => {                loadingScreen.style.display = 'none';            }, 500);        }, 500);    }}
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

// Audio system for game sounds
let isGameOver = false;

// Loading tracking
let totalAssets = 0;
let loadedAssets = 0;
let loadingScreen;
let loadingBar;
let loadingText;

function updateLoadingProgress(message) {
    if (!loadingBar || !loadingText) return;
    
    loadedAssets++;
    const progress = (loadedAssets / totalAssets) * 100;
    loadingBar.style.width = `${progress}%`;
    loadingText.textContent = message || `Loading... ${Math.round(progress)}%`;
    
    // Hide loading screen when everything is loaded
    if (loadedAssets >= totalAssets) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 500);
    }
}

// Initialize and start the game
// Ensure DOM is loaded before trying to get elements or add listeners that depend on DOM elements
document.addEventListener('DOMContentLoaded', () => {
    // Get loading screen elements
    loadingScreen = document.getElementById('loadingScreen');
    loadingBar = document.getElementById('loadingBar');
    loadingText = document.getElementById('loadingText');
    
    // Add transition for smooth fade-out
    if (loadingScreen) {
        loadingScreen.style.transition = 'opacity 0.5s ease-out';
    }
    
    // Calculate total assets to load
    totalAssets = 8; // Base assets: scene, camera, renderer, lights, floor texture, skybox, audio system, hazards
    
    init();
});

function init() {
    playerHealth = PLAYER_HEALTH_INITIAL; // From config.js
    
    // Initialize audio system immediately without waiting for interaction
    if (typeof initAudio === 'function') {
        initAudio().catch(err => console.warn('Audio initialization failed:', err));
        updateLoadingProgress('Audio system initialized');
    }
    
    currentPlayerSpeed = PLAYER_SPEED; // Initialize current speed from config
    powerUpSpawnTimer = 0; // Initialize power-up spawn timer
    isPlayerDead = false;

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
    updateLoadingProgress('Scene created');

    // Create skybox
    const skyLoader = new THREE.TextureLoader();
    skyLoader.load('sky.jfif', function(texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        updateLoadingProgress('Skybox loaded');
    });

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    player = camera; // Player is the camera
    player.rotation.order = 'YXZ'; // Explicitly set Euler order for consistent FPS controls
    updateLoadingProgress('Camera initialized');

    // Add player spotlight
    playerSpotlight = new THREE.SpotLight(0xffffff, 1);
    playerSpotlight.angle = Math.PI / 6;
    playerSpotlight.penumbra = 0.2;
    playerSpotlight.decay = 1.5;
    playerSpotlight.distance = 15;
    playerSpotlight.castShadow = true;
    playerSpotlight.shadow.mapSize.width = 512;
    playerSpotlight.shadow.mapSize.height = 512;
    playerSpotlight.shadow.camera.near = 0.5;
    playerSpotlight.shadow.camera.far = 20;
    playerSpotlight.position.set(0, 0.5, 0);
    player.add(playerSpotlight);
    
    const spotlightTarget = new THREE.Object3D();
    spotlightTarget.position.set(0, 0, -1);
    player.add(spotlightTarget);
    playerSpotlight.target = spotlightTarget;

    // Create renderer
    const gameCanvas = document.getElementById('gameCanvas');
    if (!gameCanvas) {
        console.error("gameCanvas not found!");
        return;
    }
    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1;
    updateLoadingProgress('Renderer initialized');

    // Set up post-processing
    composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add bloom effect
    bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,    // bloom strength
        0.4,    // bloom radius
        0.85    // bloom threshold
    );
    composer.addPass(bloomPass);
    updateLoadingProgress('Post-processing setup complete');

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
            updateLoadingProgress('Floor texture loaded');
        },
        undefined,
        function (err) {
            console.error('An error happened while loading the floor texture:', err);
            updateLoadingProgress('Floor texture failed to load');
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
            // Resume audio context if needed
            if (typeof resumeAudio === 'function') {
                resumeAudio();
            }
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
        
        // Replace the old hazard creation with our new function
        createHazardZones();
        updateLoadingProgress('Game elements initialized');
        
        // Start animation loop
        animate();
    }, 3000); // Give the maze time to generate
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (player && !isGameOver) {
        // Update player movement
        updatePlayer(delta);
        
        // Update walking sound
        if (typeof updateWalkingSound === 'function') {
            updateWalkingSound();
        }
        
        // Check hazard collisions
        checkHazardCollisions(player.position);
        
        // Update hazard effects
        updateHazardEffects(delta);
        
        // Update spotlight target's world matrix
        if (playerSpotlight && playerSpotlight.target) {
            playerSpotlight.target.updateMatrixWorld();
        }
        
        // Update game elements
        updateBullets(delta); // from bullet.js
        updateParticles(delta); // from bullet.js - particle system for bullet trails
        updateEnemies(delta); // from enemy.js
        updatePowerUps(delta); // from powerups.js
        powerUpSpawnTimer += delta; // Increment global timer used by powerups.js for bobbing
        updateEnemyProjectiles(delta); // from enemy_types.js (or wherever it's moved)
        
        // Update multiplayer components
        updateOtherPlayers(delta); // from multiplayer.js
    }

    // Use composer instead of renderer
    if (composer && scene && camera) {
        composer.render();
    }
}

function createHazardZones() {
    if (!createHazardZone || !scene) {
        console.error('Could not create hazard zones: createHazardZone function or scene not available');
        return;
    }

    console.log('Creating hazard zones...');
    const actualGridSize = maze.length;
    const hazardSize = new THREE.Vector3(10, 1, 10); // Changed to Vector3 with y=1 for height

    // Create an array of strategic positions for hazards
    const hazardPositions = [
        // Corner regions (4 hazards)
        { x: -40, z: -40 },
        { x: 40, z: -40 },
        { x: -40, z: 40 },
        { x: 40, z: 40 },

        // Mid-edge regions (4 hazards)
        { x: 0, z: -40 },
        { x: 0, z: 40 },
        { x: -40, z: 0 },
        { x: 40, z: 0 },

        // Inner ring (8 hazards)
        { x: -20, z: -20 },
        { x: 20, z: -20 },
        { x: -20, z: 20 },
        { x: 20, z: 20 },
        { x: 0, z: -20 },
        { x: 0, z: 20 },
        { x: -20, z: 0 },
        { x: 20, z: 0 },

        // Random positions in quadrants (4 hazards)
        { x: -30, z: -10 },
        { x: 30, z: 10 },
        { x: -10, z: 30 },
        { x: 10, z: -30 }
    ];

    // Create hazards at each position
    hazardPositions.forEach((pos, index) => {
        // Alternate between acid and lava for variety
        const hazardType = index % 2 === 0 ? 'ACID' : 'LAVA';
        createHazardZone(
            hazardType,
            new THREE.Vector3(pos.x, -1, pos.z),
            hazardSize
        );
    });
}

// Update window resize handler
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update composer size
        if (composer) {
            composer.setSize(window.innerWidth, window.innerHeight);
        }
        
        // Update bloom pass resolution
        if (bloomPass) {
            bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        }
    }
    // ... rest of resize code ...
}