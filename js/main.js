// Game variables (initialized in init or by other modules)let scene, camera, renderer;let composer; // For post-processinglet bloomPass; // For glow effectlet player; // Is the camera objectlet playerSpotlight; // Spotlight attached to playerlet playerHealth; // Initialized from PLAYER_HEALTH_INITIAL in initlet playerControlledRocketAmmo; // New: Ammunition for special rockets
// Loading trackinglet totalAssets = 0;let loadedAssets = 0;let loadingScreen;let loadingBar;let loadingText;function updateLoadingProgress(message) {    if (!loadingBar || !loadingText) return;        loadedAssets++;    const progress = (loadedAssets / totalAssets) * 100;    loadingBar.style.width = `${progress}%`;    loadingText.textContent = message || `Loading... ${Math.round(progress)}%`;        // Hide loading screen when everything is loaded    if (loadedAssets >= totalAssets) {        setTimeout(() => {            loadingScreen.style.opacity = '0';            setTimeout(() => {                loadingScreen.style.display = 'none';            }, 500);        }, 500);    }}
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let bullets = [], enemies = [], walls = [];
let maze = []; // Populated by generateMaze() in maze.js
let playerVelocity = new THREE.Vector3();
let direction = new THREE.Vector3(); // For player movement calculation
let clock = new THREE.Clock();
let keysPressed = {}; // Global object to store pressed keys

// Mobile control variables (initialized/updated in ui.js)
let joystickActive = false;
let joystickDirection = new THREE.Vector2();
let turnJoystickDirection = new THREE.Vector2(); // For the turning joystick
let joystickKnob, joystick, joystickRect, shootButton, launchRocketBtnElement; // Added launchRocketBtnElement
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
    playerControlledRocketAmmo = 2; // Initialize special rocket ammo
    keysPressed = {}; // Ensure keysPressed is reset on init
    
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
        // Rocket-specific power-up effects
        POWERUP_TYPES.ROCKET_AMMO.effect = (player) => {
            playerControlledRocketAmmo = Math.min(playerControlledRocketAmmo + 1, 5); // Max 5 rockets
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay(50);
            if (typeof showNotification === 'function') showNotification("+1 Rocket Ammo!");
        };
        POWERUP_TYPES.ROCKET_SPEED.effect = (player) => {
            // Store original rocket speed
            const originalRocketSpeed = ROCKET_SPEED;
            ROCKET_SPEED *= 1.5; // Increase rocket speed by 50%
            
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay(75);
            if (typeof showNotification === 'function') showNotification("Rocket Speed Boost!");
            
            // Reset after 20 seconds
            setTimeout(() => {
                ROCKET_SPEED = originalRocketSpeed;
                if (typeof showNotification === 'function') showNotification("Rocket Speed Boost Expired!");
            }, 20000);
        };
        POWERUP_TYPES.ROCKET_HOMING.effect = (player) => {
            // Enable homing rockets
            const originalHomingEnabled = ROCKET_HOMING_ENABLED;
            ROCKET_HOMING_ENABLED = true;
            
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay(100);
            if (typeof showNotification === 'function') showNotification("Homing Rockets Enabled!");
            
            // Reset after 30 seconds
            setTimeout(() => {
                ROCKET_HOMING_ENABLED = originalHomingEnabled;
                if (typeof showNotification === 'function') showNotification("Homing Rockets Disabled!");
            }, 30000);
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
    
    // Initialize weapon display and selector
    if (typeof updateWeaponDisplay === 'function') {
        updateWeaponDisplay();
    }
    if (typeof createWeaponSelector === 'function') {
        createWeaponSelector();
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

    if (composer && scene && camera) {
        // Check if we are controlling a rocket and adjust camera target if necessary
        const currentControlledRocket = typeof getActiveControlledRocket === 'function' ? getActiveControlledRocket() : null;
        if (currentControlledRocket && currentControlledRocket.rocketCamera) {
            // If composer has a dedicated camera reference different from the global `camera`,
            // it might need updating here. For now, assuming `setActiveCamera` handles the global `camera`
            // which is then used by the composer.
        } else if (player && player.visible) {
            // Ensure main player camera is active if no rocket is controlled.
            // This might be redundant if setActiveCamera is called correctly when rocket ends.
        }
        composer.render();
    }
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
        
        // Update spotlight position and direction if it exists
        if (playerSpotlight) {
            playerSpotlight.position.copy(player.position);
            const dir = new THREE.Vector3();
            player.getWorldDirection(dir); // player is the main camera
            playerSpotlight.target.position.copy(player.position).add(dir);
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

    // Render scene through composer if available, else direct render
    if (composer) {
        if (!camera) {
            console.error("[MAIN.JS] animate: Global camera is null! Attempting to reset to player camera.");
            setActiveCamera(player);
        }
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
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

// Function to set the active camera for rendering
function setActiveCamera(newCamera) {
    console.log("[MAIN.JS] setActiveCamera: Called with newCamera:", newCamera ? newCamera.uuid : 'null', "Is it player?", newCamera === player, "Is it active rocket?", newCamera === getActiveControlledRocket());
    camera = newCamera;
    console.log("[MAIN.JS] setActiveCamera: Global 'camera' variable is NOW:", camera ? camera.uuid : 'null');
    if (composer && composer.passes && composer.passes.length > 0 && composer.passes[0].camera) {
        composer.passes[0].camera = camera; // Update the camera for the render pass
        console.log("[MAIN.JS] setActiveCamera: Composer's RenderPass camera updated to:", composer.passes[0].camera ? composer.passes[0].camera.uuid : 'null');
    } else {
        console.warn("[MAIN.JS] setActiveCamera: Composer or its RenderPass camera not found. Skipping update.");
    }
}

// Function to launch the player-controlled rocket
function launchPlayerControlledRocket() {
    if (isPlayerDead || getActiveControlledRocket()) return; // Don't launch if dead or already controlling one

    if (playerControlledRocketAmmo <= 0) {
        console.log("[MAIN.JS] launchPlayerControlledRocket: Out of ammo. Switching to default weapon.");
        currentWeaponLevel = 0; // Switch to default weapon (level 0)
        if (typeof updateWeaponDisplay === 'function') updateWeaponDisplay();
        return;
    }

    // Assuming 'R' key press in player.js has already set currentWeaponLevel to the rocket launcher.
    const currentWeapon = WEAPON_TYPES[currentWeaponLevel];
    const shootDirection = new THREE.Vector3();
    player.getWorldDirection(shootDirection);

    let launchedSuccessfully = false;
    if (typeof otherPlayers !== 'undefined' && Object.keys(otherPlayers).length > 0 && photon && photon.isJoinedToRoom()) {
        const eventData = {
            weaponType: currentWeapon.id,
            direction: { x: shootDirection.x, y: shootDirection.y, z: shootDirection.z },
            launchPosition: { x: player.position.x, y: player.position.y, z: player.position.z },
            isPlayerControlled: true,
            ownerActorNr: player.actorNr
        };
        photon.raiseEvent(PLAYER_CONTROLLED_ROCKET_LAUNCH_EVENT_CODE, eventData);
        console.log("[MAIN.JS] launchPlayerControlledRocket: Raised Photon event.");
        
        if (handleLocalPlayerControlledRocketLaunch(currentWeapon, shootDirection)) {
            launchedSuccessfully = true;
        }
    } else if (typeof otherPlayers !== 'undefined' && Object.keys(otherPlayers).length > 0) {
        // Fallback for local launch if Photon not connected but remote players are somehow listed (unlikely)
        // Or, more likely, this branch is for single-player testing if we bypass the otherPlayers check for that.
        // For now, let's assume if otherPlayers > 0, Photon should be used.
        // If we want a true single-player mode for this, logic needs adjustment.
        console.log("[MAIN.JS] launchPlayerControlledRocket: Remote players detected, but Photon not ready/joined. Attempting local launch only.");
        if (handleLocalPlayerControlledRocketLaunch(currentWeapon, shootDirection)) {
            launchedSuccessfully = true;
        }
    } else {
        console.log("[MAIN.JS] launchPlayerControlledRocket: No remote players. Not launching multiplayer rocket.");
        // if (typeof showNotification === 'function') showNotification("No other players to target!");
        return; // Do not proceed if no remote players, as per original logic intent
    }

    if (launchedSuccessfully) {
        playerControlledRocketAmmo--;
        console.log(`[MAIN.JS] Player-controlled rocket launched. Ammo: ${playerControlledRocketAmmo}`);
        // if (typeof updateRocketAmmoUI === 'function') updateRocketAmmoUI();

        if (playerControlledRocketAmmo <= 0) {
            console.log("[MAIN.JS] launchPlayerControlledRocket: Last rocket fired. Switching to default weapon.");
            currentWeaponLevel = 0; // Switch to default weapon (level 0)
            if (typeof updateWeaponDisplay === 'function') updateWeaponDisplay();
        }
    }
}

// Helper to actually create the rocket and switch camera locally
function handleLocalPlayerControlledRocketLaunch(weapon, direction) {
    // Temporarily store the bullets array length to find the new rocket
    const bulletsBeforeShot = bullets.length;
    
    const newRocket = createRocketShot(weapon, direction, true); // This function is from bullet.js and now global
    
    if (newRocket && newRocket.isPlayerControlled) {
        switchToRocketCamera(newRocket); // switchToRocketCamera from bullet.js
        if (typeof playSound === 'function') {
            playSound('rocket_launch_local'); // Specific sound for this launch
        }
        return true; // Indicate successful launch
    } else {
        console.error("Failed to create or identify player-controlled rocket.");
        // Attempt to find it if createRocketShot doesn't return it directly
        if (bullets.length > bulletsBeforeShot) {
            const possiblyNewRocket = bullets[bullets.length-1];
            if (possiblyNewRocket.isRocket && possiblyNewRocket.isPlayerControlled && possiblyNewRocket.ownerActorNr === player.actorNr) {
                switchToRocketCamera(possiblyNewRocket);
                 if (typeof playSound === 'function') {
                    playSound('rocket_launch_local');
                }
                return true; // Indicate successful launch
            }
        }
        console.error("New bullet is not the player-controlled rocket we expected.");
        return false; // Indicate failed launch
    }
}

// Make setActiveCamera globally accessible if not already
window.setActiveCamera = setActiveCamera;
window.launchPlayerControlledRocket = launchPlayerControlledRocket; // Expose for keydown in player.js

function setupMobileControls() {
    joystick = document.getElementById('joystick');
    joystickKnob = document.getElementById('joystickKnob');
    shootButton = document.getElementById('shootButton');
    launchRocketBtnElement = document.getElementById('launchRocketButton'); // Get the new button

    if (joystick && joystickKnob) {
        joystickRect = joystick.getBoundingClientRect();
        // ... existing code ...
    }

    if (shootButton) {
        shootButton.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default touch actions like scrolling
            if (!isPlayerDead && typeof shootMultiplayer === 'function' && !getActiveControlledRocket()) {
                shootMultiplayer();
            }
        }, { passive: false }); // Use passive: false if preventDefault is used

        shootButton.addEventListener('touchend', (e) => {
            e.preventDefault(); 
        });
    }

    if (launchRocketBtnElement) {
        launchRocketBtnElement.addEventListener('click', handleRocketButtonPress); // For desktop clicks
        launchRocketBtnElement.addEventListener('touchstart', (e) => { // For mobile touch
            e.preventDefault();
            handleRocketButtonPress();
        }, { passive: false });
    }
}

function handleRocketButtonPress() {
    if (isPlayerDead || (typeof getActiveControlledRocket === 'function' && getActiveControlledRocket())) {
        console.log("[MAIN.JS] Rocket button: Cannot fire, player dead or already controlling rocket.");
        return;
    }

    console.log("[MAIN.JS] Rocket button pressed.");
    // Instantly switch to Rocket Launcher weapon type
    // WEAPON_TYPES and currentWeaponLevel are global
    const rocketLauncherLevel = WEAPON_TYPES.findIndex(w => w.bulletType === 'rocket');
    if (rocketLauncherLevel !== -1) {
        currentWeaponLevel = rocketLauncherLevel;
        console.log(`[MAIN.JS] Switched to Rocket Launcher (level ${currentWeaponLevel}) via UI button.`);
        if (typeof updateWeaponDisplay === 'function') {
            updateWeaponDisplay();
        }
    } else {
        console.warn("[MAIN.JS] Could not find Rocket Launcher weapon type in config for UI button.");
        return; 
    }

    // Now attempt to launch the player-controlled rocket
    // launchPlayerControlledRocket is global from main.js
    if (typeof launchPlayerControlledRocket === 'function') {
        launchPlayerControlledRocket();
    }
}