// Multiplayer functionality using Photon

// Global variables for multiplayer
let photon;
let otherPlayers = {}; // Map of playerID -> player object
let localPlayerID = null;
let localPlayerColor = 0xdddddd; // Default color, will be randomized in onJoinRoom

// Centralized function to manage enemy spawning based on remote players
function manageEnemySpawningBasedOnRemotePlayers() {
    if (typeof otherPlayers === 'undefined' || typeof enemies === 'undefined' ||
        typeof createEnemies !== 'function' || typeof removeAllEnemies !== 'function' ||
        typeof ENEMY_COUNT === 'undefined') {
        console.warn("manageEnemySpawning: Missing necessary globals or functions (otherPlayers, enemies, createEnemies, removeAllEnemies, ENEMY_COUNT).");
        return;
    }

    let aliveRemotePlayers = 0;
    let loadingPlayers = false;
    
    for (const id in otherPlayers) {
        // Consider a player alive if HP is not explicitly 0 or less.
        // If hp is undefined, assume they are alive until first update.
        if (otherPlayers[id] && (typeof otherPlayers[id].hp === 'undefined' || otherPlayers[id].hp > 0)) {
            aliveRemotePlayers++;
        }
        // Also check if any player model is loading
        if (otherPlayers[id] && otherPlayers[id].loading === true) {
            loadingPlayers = true;
        }
    }

    console.log(`manageEnemySpawning: Found ${aliveRemotePlayers} alive remote players. Current enemy count: ${enemies.length}. Loading players: ${loadingPlayers}`);

    if (aliveRemotePlayers === 0 && !loadingPlayers) {
        // No alive remote players, ensure local enemies are present
        if (enemies.length === 0) {
            // Check if we're using a maze or a simple plane
            const isMazeReady = typeof DRAW_MAZE !== 'undefined' && DRAW_MAZE ? 
                (typeof maze !== 'undefined' && maze.length > 0) : 
                true; // If not using maze, consider it "ready"
            
            if (isMazeReady) {
                console.log("manageEnemySpawning: No alive remote players and no local enemies. Environment ready. Spawning enemies.");
                createEnemies(ENEMY_COUNT);
            } else {
                console.warn("manageEnemySpawning: No alive remote players, no local enemies, but MAZE IS NOT READY. Cannot spawn enemies yet.");
            }
        } else {
            console.log("manageEnemySpawning: No alive remote players, local enemies already present.");
        }
    } else {
        // One or more alive remote players or loading players, ensure local enemies are removed
        if (enemies.length > 0) {
            console.log("manageEnemySpawning: Alive or loading remote players present. Removing local enemies.");
            removeAllEnemies();
        } else {
            console.log("manageEnemySpawning: Alive or loading remote players present, no local enemies to remove.");
        }
    }
}

// Player model for other players (visible to others) - Now uses createRobotPlayerModel
// The old createPlayerModel function is replaced by the one in js/player_model.js
// We'll call createRobotPlayerModel directly where createPlayerModel was called.
// function createPlayerModel(color) { ... } // This function is now removed/commented

// Initialize Photon connection
function initializeMultiplayer() {
    // Use protocol 0 (WS) for localhost/HTTP, protocol 1 (WSS) for HTTPS
    const protocol = window.location.protocol === 'https:' ? 1 : 0;
    console.log(`Initializing multiplayer with protocol ${protocol} (${window.location.protocol})`);
    
    try {
        photon = new Photon.LoadBalancing.LoadBalancingClient(protocol, "a3478f4a-f2cb-4eb1-aa07-d3427e6b93fd", "1.0");
        console.log("Photon client created successfully");
    } catch (error) {
        console.error("Error creating Photon client:", error);
        return;
    }
    
    // Set callbacks
    photon.onStateChange = onStateChange;
    photon.onJoinRoom = onJoinRoom;
    photon.onActorJoin = onPlayerJoin;
    photon.onActorLeave = onPlayerLeave;
    photon.onEvent = onEvent;
    
    // Add error handler
    photon.onError = function(errorCode, errorMsg) {
        console.error("Photon Error:", errorCode, errorMsg);
    };
    
    // Connect to Name Server first
    console.log("Attempting to connect to Name Server...");
    try {
        photon.connectToNameServer();
        console.log("Name Server connection request sent");
    } catch (error) {
        console.error("Error connecting to Name Server:", error);
    }
    
    // Setup broadcast interval
    setInterval(broadcastPlayerState, 100);
    
    // Add connection health check
    setInterval(checkConnection, 5000);
}

// Callback when the connection state changes
function onStateChange(state) {
    const states = {
        0: "Uninitialized",
        1: "ConnectingToNameServer",
        2: "ConnectedToNameServer",
        3: "ConnectingToMasterServer",
        4: "ConnectedToMaster",
        5: "JoiningLobby",
        6: "ConnectedToLobby",
        7: "Disconnecting",
        8: "Disconnected",
        9: "ConnectingToGameServer",
        10: "ConnectedToGameServer",
        11: "JoiningRoom",
        12: "JoinedRoom",
        13: "LeavingRoom",
        14: "Error"
    };
    
    console.log("Photon state changed to:", states[state] || state);
    
    switch (state) {
        case Photon.LoadBalancing.LoadBalancingClient.State.ConnectedToNameServer:
            console.log("Connected to Name Server, connecting to region master...");
            try {
                photon.connectToRegionMaster("us");
                console.log("Region Master connection request sent");
            } catch (error) {
                console.error("Error connecting to Region Master:", error);
            }
            break;
            
        case Photon.LoadBalancing.LoadBalancingClient.State.ConnectedToMaster:
            console.log("Connected to Master Server, joining/creating room...");
            try {
                photon.joinRoom("MazeShooterRoom", { createIfNotExists: true });
                console.log("Room join/create request sent");
            } catch (error) {
                console.error("Error joining/creating room:", error);
            }
            break;
            
        case Photon.LoadBalancing.LoadBalancingClient.State.Error:
            console.error("Connection error detected. Current state details:", photon.state);
            setTimeout(() => {
                if (!photon.isConnectedToMaster()) {
                    console.log("Attempting to reconnect to Name Server...");
                    try {
                        photon.connectToNameServer();
                        console.log("Name Server reconnection request sent from checkConnection");
                    } catch (error) {
                        console.error("Error during checkConnection reconnection attempt:", error);
                    }
                }
            }, 3000);
            break;
    }
}

// Function to check connection health and reconnect if needed
function checkConnection() {
    if (!photon) {
        console.error("checkConnection: Photon client is not initialized");
        return;
    }
    
    if (!photon.isConnectedToMaster() && !photon.isJoinedToRoom()) {
        console.log("Connection check: Not connected. State:", photon.state);
        console.log("Attempting to reconnect to Name Server...");
        try {
            photon.connectToNameServer();
            console.log("Name Server reconnection request sent from checkConnection");
        } catch (error) {
            console.error("Error during checkConnection reconnection attempt:", error);
        }
    }
}

// Callback when local player joins a room
function onJoinRoom() {
    console.log("onJoinRoom: Successfully joined room:", photon.currentRoom.name);
    // Clear otherPlayers list for a fresh start in this room
    otherPlayers = {};
    console.log("onJoinRoom: Cleared otherPlayers object.");
    localPlayerID = photon.myActor().actorNr;
    // Generate a random color for the local player
    localPlayerColor = Math.random() * 0xffffff;
    console.log("onJoinRoom: localPlayerID set to:", localPlayerID, "My Actor:", photon.myActor(), "My Color:", localPlayerColor.toString(16));

    // Create models for players already in the room
    console.log("onJoinRoom: Checking for existing players in the room...");
    const actorsInRoom = photon.actors;
    if (actorsInRoom) {
        for (const actorNrKey in actorsInRoom) {
            const actor = actorsInRoom[actorNrKey];
            // Ensure actor and actor.actorNr exist, and it's not the local player
            if (actor && typeof actor.actorNr === 'number' && actor.actorNr !== localPlayerID) {
                const existingPlayerID = actor.actorNr;
                console.log(`onJoinRoom: Found existing remote player ${existingPlayerID}. Attempting to create model.`);
                if (!otherPlayers[existingPlayerID]) {
                    // Load the GLB model instead of using createRobotPlayerModel
                    loadRemotePlayerModel(existingPlayerID, Math.random() * 0xffffff);
                } else {
                    console.log(`onJoinRoom: Model for existing remote player ${existingPlayerID} already present.`);
                }
            } else if (actor && actor.actorNr === localPlayerID) {
                // console.log(`onJoinRoom: Found local player ${actor.actorNr} in actorsInRoom list. Skipping model creation.`);
            } else {
                // console.warn("onJoinRoom: Found an actor in actorsInRoom without a valid actorNr or it's undefined:", actor);
            }
        }
    } else {
        console.warn("onJoinRoom: photon.actors list not found or empty.");
    }

    // Maze logic for static maze or simple plane
    if (typeof DRAW_MAZE !== 'undefined' && DRAW_MAZE) {
        console.log("DRAW_MAZE is true. All clients will generate the static maze locally.");
        if (typeof generateMaze === 'function') generateMaze();    // All clients generate the same static maze
        if (typeof createMazeWalls === 'function') createMazeWalls(); // All clients build it locally
        if (typeof setupMiniMap === 'function') {
            console.log("Calling setupMiniMap from onJoinRoom.");
            setupMiniMap(); // Setup minimap after maze is ready for this client
        }
    } else {
        console.log("DRAW_MAZE is false. Skipping maze generation. Using simple plane.");
    }
    setLocalPlayerInitialPosition(); // Set player position (works for both maze and plane)

    // Manage enemy spawning based on current remote player status
    manageEnemySpawningBasedOnRemotePlayers();
}

/* // sendMazeData is no longer needed for static maze
function sendMazeData() {
    // This function is now obsolete as maze is static and generated by all clients.
    // console.log("sendMazeData: This function is obsolete for static mazes.");
}
*/

// New function to load the GLB model for remote players
function loadRemotePlayerModel(playerID, color) {
    // Mark this player as loading - add to otherPlayers immediately
    otherPlayers[playerID] = {
        loading: true,
        lastUpdate: Date.now(),
        targetPosition: null,
        targetRotationY: null,
        isMoving: false,
        firstPositionUpdate: true, // Flag to indicate we need to snap to position on first update
        color: color
    };
    
    // Immediately manage enemies when we start loading a player model
    manageEnemySpawningBasedOnRemotePlayers();
    
    const loader = new THREE.GLTFLoader();
    loader.load('model/robot.glb', (gltf) => {
        const playerModel = gltf.scene;
        
        // Preserve the original materials and colors from the GLB file
        playerModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        
        // Scale and position the model
        playerModel.scale.set(1.2, 1.2, 1.2); // Adjust scale as needed
        
        // If we already have a targetPosition from updates that came in during loading,
        // use that instead of the default position, but adjust Y coordinate to sit properly on the floor
        let initialPosition;
        if (otherPlayers[playerID].targetPosition) {
            initialPosition = otherPlayers[playerID].targetPosition.clone();
            initialPosition.y = 0.6; // Adjust this value to position the model on the floor
        } else {
            initialPosition = new THREE.Vector3(playerID * 5, 0.6, 0); // Y=0.6 to sit on the floor
        }
        
        playerModel.position.copy(initialPosition);
        
        // Rotate model to face forward
        playerModel.rotation.y = (otherPlayers[playerID].targetRotationY || 0); // Remove the Math.PI default rotation
        
        // Add to scene
        scene.add(playerModel);
        
        // Update player entry in otherPlayers
        // Preserve existing data like position and rotation
        const existingData = otherPlayers[playerID];
        otherPlayers[playerID] = {
            ...existingData,
            model: playerModel,
            lastUpdate: Date.now(),
            loading: false,  // No longer loading
            // If we didn't have a target position before, create one from the initial position
            targetPosition: existingData.targetPosition || initialPosition.clone()
        };
        
        console.log(`loadRemotePlayerModel: Created and stored GLB model for remote player ${playerID}.`);
        
        // Check for enemies again after loading completes
        manageEnemySpawningBasedOnRemotePlayers();
    }, 
    // onProgress callback
    (xhr) => {
        console.log(`Loading remote player model: ${(xhr.loaded / xhr.total * 100)}% loaded`);
    },
    // onError callback
        (error) => {        console.error('Error loading remote player GLB model:', error);                // Check if the player still exists in otherPlayers        if (!otherPlayers[playerID]) {            console.warn(`Player ${playerID} no longer exists in otherPlayers, skipping fallback model creation`);            return;        }                // Fallback to created model if GLB fails        const playerModel = createRobotPlayerModel(color);                // Create initial position with safe defaults        let initialPosition = new THREE.Vector3(playerID * 2, 0.6, -7);                // Only try to use existing position if it's available        const existingData = otherPlayers[playerID];        if (existingData && existingData.targetPosition) {            initialPosition.copy(existingData.targetPosition);            initialPosition.y = 0.6; // Ensure correct height        }                                      playerModel.position.copy(initialPosition);        playerModel.rotation.y = (existingData && existingData.targetRotationY) || 0;                scene.add(playerModel);                // Update player entry in otherPlayers with safe fallbacks        otherPlayers[playerID] = {            ...(existingData || {}),            model: playerModel,            lastUpdate: Date.now(),            loading: false,            targetPosition: initialPosition.clone()        };
        
        // Check for enemies again after loading completes
        manageEnemySpawningBasedOnRemotePlayers();
    });
}

// Callback when another player joins
function onPlayerJoin(actor) {
    const playerID = actor.actorNr;
    console.log(`onPlayerJoin: Event for actorNr ${playerID}. My localPlayerID is ${localPlayerID}. Actor details:`, actor);

    if (playerID === localPlayerID) {
        console.log(`onPlayerJoin: actorNr ${playerID} is local player. No remote model created.`);
        return;
    }
    
    console.log(`onPlayerJoin: actorNr ${playerID} is a remote player. Creating model.`);
    // Load the GLB model for the remote player
    loadRemotePlayerModel(playerID, Math.random() * 0xffffff);
    
    manageEnemySpawningBasedOnRemotePlayers();
}

// Callback when another player leaves
function onPlayerLeave(actor) {
    const playerID = actor.actorNr;
    console.log(`onPlayerLeave: Player ${playerID} left. LocalPlayerID: ${localPlayerID}. Actor details:`, actor);
    
    if (otherPlayers[playerID]) {
        // If player has a model, remove it
        if (otherPlayers[playerID].model) {
            scene.remove(otherPlayers[playerID].model);
        }
        // Remove player from otherPlayers object
        delete otherPlayers[playerID];
        
        console.log(`onPlayerLeave: Removed player ${playerID} from otherPlayers. Managing enemy spawning.`);
        manageEnemySpawningBasedOnRemotePlayers();
    }
}

// Broadcast player state (position, rotation)
function broadcastPlayerState() {
    if (!photon.isJoinedToRoom() || !player) return;
    
    try {
        // If player is dead, ensure we broadcast 0 health
        const currentHealth = isPlayerDead ? 0 : playerHealth;
        
        photon.raiseEvent(2, {
            position: {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            },
            rotation: {
                y: player.rotation.y,
                x: player.rotation.x
            },
            hp: currentHealth
        });
        
        // Log when broadcasting 0 health
        if (currentHealth <= 0) {
            console.log("Broadcasting dead state (health = 0)");
        }
    } catch (error) {
        console.warn("Error broadcasting player state:", error);
    }
}

// Handle shooting in multiplayer
function shootMultiplayer() {
    // Get current weapon (WEAPON_TYPES and currentWeaponLevel are global, from config.js)
    const currentWeapon = WEAPON_TYPES[currentWeaponLevel];

    // Check conditions for launching a player-controlled rocket via standard fire
    if (currentWeapon && currentWeapon.bulletType === 'rocket' && 
        typeof playerControlledRocketAmmo !== 'undefined' && playerControlledRocketAmmo > 0 &&
        typeof otherPlayers !== 'undefined' && Object.keys(otherPlayers).length > 0 &&
        typeof window.launchPlayerControlledRocket === 'function') {

        // Call the global function from main.js that handles player-controlled rocket launch
        // This function already checks ammo, remote players, weapon type, raises event 5, and handles local launch + camera.
        window.launchPlayerControlledRocket();
        return; // Important: Don't proceed to fire a standard rocket
    }

    // If conditions for player-controlled rocket are not met, proceed with standard shot:
    shoot(); // Local call to shoot() from bullet.js
    
    // Then notify others about a standard shot (event 3)
    if (photon.isJoinedToRoom()) {
        const shootDirection = new THREE.Vector3();
        player.getWorldDirection(shootDirection);
        
        photon.raiseEvent(3, {
            position: {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            },
            direction: {
                x: shootDirection.x,
                y: shootDirection.y, 
                z: shootDirection.z
            }
        });
    }
}

// Handle event from other players
function onEvent(code, content, actorNr) {
    // Ignore events from self
    if (actorNr === localPlayerID) return;
    
    switch (code) {
        // Case 1 for maze data is no longer needed for static maze
        /*
        case 1: // Maze data
            if (typeof DRAW_MAZE !== 'undefined' && DRAW_MAZE) {
                // This case is obsolete for static mazes, as each client generates it locally.
                // If for some reason it's still called, log it.
                console.warn("Received event 1 (maze data) which is obsolete for static mazes. Actor:", actorNr, "Content:", content);
            }
            break;
        */
        case PHOTON_EVENT_PLAYER_STATE_UPDATE: // Player state update (use constant from config.js)
            updateRemotePlayerState(actorNr, content); // actorNr here is the sender of the state
            break;
            
        case PHOTON_EVENT_PLAYER_SHOOT_STANDARD: // Shooting (use constant from config.js)
            handleRemotePlayerShoot(content, actorNr); // Pass actorNr for context if needed by createRocketShot
            break;

        case PHOTON_EVENT_PLAYER_HIT: // Player hit (use constant from config.js)
            if (content && typeof content.victimActorNr === 'number') {
                const victimID = content.victimActorNr;
                console.log(`onEvent: Received event 4 (player_hit). Victim: ${victimID}, Event sent by: ${actorNr}`);
                if (victimID === localPlayerID) {
                    // This client's local player was hit
                    playerHealth -= BULLET_DAMAGE; // BULLET_DAMAGE from config.js
                    console.log(`onEvent: Local player (ID: ${localPlayerID}) hit. New health: ${playerHealth}`);
                                        if (playerHealth <= 0) {                        console.log("Local player died.");                        isPlayerDead = true;                        if (typeof gameOver === 'function') {                            gameOver();                        }                    }
                    // Update local health UI immediately
                     document.getElementById('healthFill').style.width = Math.max(0, playerHealth) + '%';

                } else if (otherPlayers[victimID]) {
                    // A remote player was hit. Their client will manage their actual health.
                    // We can log this or show a hit marker.
                    // The health of otherPlayers[victimID].model isn't directly managed here,
                    // it's updated via their own state broadcasts (event 2).
                    console.log(`onEvent: Remote player ${victimID} was hit (according to player ${actorNr}).`);
                } else {
                    console.warn(`onEvent: Received hit event for unknown victimActorNr: ${victimID}`);
                }
            } else {
                console.warn("onEvent: Received event 4 (player_hit) but content or victimActorNr is missing.");
            }
            break;
        case PLAYER_CONTROLLED_ROCKET_LAUNCH_EVENT_CODE: // New: Player-controlled rocket launched
            console.log(`Received PLAYER_CONTROLLED_ROCKET_LAUNCH_EVENT_CODE from actorNr: ${actorNr}`, content);
            handleRemotePlayerControlledRocketLaunch(content, actorNr);
            break;
    }
}

// Update another player's state
function updateRemotePlayerState(playerID, data) {
    if (!otherPlayers[playerID] || playerID === localPlayerID) {
        return;
    }
    
    const playerObj = otherPlayers[playerID];
    playerObj.lastUpdate = Date.now();
    
    // Handle player health and death
    if (typeof data.hp === 'number') {
        const oldHp = playerObj.hp;
        playerObj.hp = data.hp;
        console.log(`Remote player ${playerID} health updated: ${oldHp} -> ${data.hp}`);
        
        // If player health is 0 or less, remove them from the scene
        if (data.hp <= 0 && playerObj.model) {
            console.log(`Player ${playerID} died (hp: ${data.hp}), attempting to remove from scene...`);
            if (playerObj.model.parent) {
                console.log(`Player ${playerID} model found in scene, parent:`, playerObj.model.parent);
                scene.remove(playerObj.model);
                console.log(`Player ${playerID} model removed from scene`);
            } else {
                console.log(`Player ${playerID} model not found in scene`);
            }
            delete otherPlayers[playerID];
            console.log(`Player ${playerID} removed from otherPlayers. Current players:`, Object.keys(otherPlayers));
            manageEnemySpawningBasedOnRemotePlayers();
            return; // Exit early since player is dead
        }
    }
    
    // Only update position and rotation if player is alive
    if (data.position && playerObj.model) {
        // Create new target position but preserve the Y value (height) we set to keep model on the floor
        const newTargetPos = new THREE.Vector3(
            data.position.x, 
            0.6, // Keep the Y position consistent to position model on the floor
            data.position.z
        );
        
        // If the model isn't loaded yet, just store position for later
        if (!playerObj.targetPosition) {
            playerObj.targetPosition = newTargetPos.clone();
        } else {
            // Check if position changed enough to be considered moving
            // Only compare X and Z for movement detection, ignore Y changes
            const currentPos = playerObj.targetPosition.clone();
            currentPos.y = 0; // Zero out Y for distance comparison
            const newPos = newTargetPos.clone();
            newPos.y = 0; // Zero out Y for distance comparison
            
            if (currentPos.distanceToSquared(newPos) > 0.001) {
                playerObj.isMoving = true;
            }
            
            // Update the target position but keep our fixed Y value
            playerObj.targetPosition.x = newTargetPos.x;
            playerObj.targetPosition.z = newTargetPos.z;
        }
        
        // If the model is loaded, move it (otherwise it will be positioned at load time)
        if (playerObj.model && playerObj.targetPosition) {
            // If this is the first position update, snap to it rather than lerp
            if (playerObj.firstPositionUpdate) {
                // Make sure we maintain the correct Y position
                playerObj.model.position.x = playerObj.targetPosition.x;
                playerObj.model.position.z = playerObj.targetPosition.z;
                playerObj.firstPositionUpdate = false;
            }
        }
    }
    
    if (data.rotation) {
        playerObj.targetRotationY = data.rotation.y;
    }
}

// Handle remote player shooting
function handleRemotePlayerShoot(data, shooterActorNr) { // shooterActorNr might be useful for context
    if (!scene) return;
    
    // Play shooting sound for remote player
    if (typeof playSound === 'function') {
        playSound('shoot');
    }
    
    const bulletGeometry = new THREE.SphereGeometry(...BULLET_GEOMETRY_ARGS);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: BULLET_COLOR });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Position bullet at shooter's position
    bullet.position.set(data.position.x, data.position.y, data.position.z);
    
    // Set velocity from direction
    const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
    bullet.velocity = direction.multiplyScalar(BULLET_SPEED);
    bullet.alive = true;
    bullet.damage = BULLET_DAMAGE; // from config.js
    bullet.ownerActorNr = shooterActorNr; // Tag bullet with who shot it
    
    // Create muzzle flash at the gun position
    if (typeof createMuzzleFlashParticles === 'function') {
        createMuzzleFlashParticles(
            new THREE.Vector3(data.position.x, data.position.y, data.position.z),
            direction,
            BULLET_COLOR
        );
    }
    
    // Add particle trail to the bullet
    if (typeof createBulletTrailParticles === 'function') {
        createBulletTrailParticles(bullet, BULLET_COLOR);
    }
    
    // Add to scene
    scene.add(bullet);
    bullets.push(bullet);
    
    // Remove after lifespan
    setTimeout(() => {
        bullet.alive = false;
        if (scene) scene.remove(bullet);
        const index = bullets.indexOf(bullet);
        if (index > -1) {
            bullets.splice(index, 1);
        }
    }, BULLET_LIFESPAN);
}

// New function to handle remote player-controlled rocket launch
function handleRemotePlayerControlledRocketLaunch(data, actorNr) {
    if (!scene || !data) return;

    console.log(`handleRemotePlayerControlledRocketLaunch called by actorNr ${actorNr}`, data);

    // Data should contain: { weaponType (or ID), direction, launchPosition, isPlayerControlled, ownerActorNr }
    const remoteDirection = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
    
    const rocketWeaponConfig = WEAPON_TYPES.find(w => w.bulletType === 'rocket');
    if (!rocketWeaponConfig) {
        console.error("Could not find rocket weapon configuration for remote player-controlled rocket.");
        return;
    }

    const effectiveWeapon = {
        ...rocketWeaponConfig, 
    };

    const launchPos = data.launchPosition ? 
        new THREE.Vector3(data.launchPosition.x, data.launchPosition.y, data.launchPosition.z) :
        null; // If launchPosition is not sent, createRocketShot will use its default.

    // Call createRocketShot, passing the initial position for remote rockets.
    const rocket = createRocketShot(effectiveWeapon, remoteDirection, data.isPlayerControlled, launchPos);

    if (rocket) {
        // ownerActorNr is set again here to be absolutely sure, though createRocketShot might set it if isPlayerControlled is true locally.
        // For remote calls, we rely on data.ownerActorNr from the event.
        rocket.ownerActorNr = data.ownerActorNr; 
        
        // Position is now set by createRocketShot based on launchPos (or defaults if launchPos was null)
        console.log(`Remote player-controlled rocket created for owner ${data.ownerActorNr}, controlled status: ${rocket.isPlayerControlled}, position: ${rocket.position.x.toFixed(2)}, ${rocket.position.y.toFixed(2)}, ${rocket.position.z.toFixed(2)}`);
        
        if (typeof playSound === 'function') {
            playSound('rocket_launch_remote'); 
        }
    } else {
        console.error("Failed to create remote player-controlled rocket.");
    }
}

// Update other players' visuals (called from animate loop)
function updateOtherPlayers(delta) {
    const now = Date.now();
    
    for (const playerID in otherPlayers) {
        const playerObj = otherPlayers[playerID];
        
        // Remove players who haven't updated in 5 seconds
        if (now - playerObj.lastUpdate > 5000) {
            if (playerObj.model) {
                scene.remove(playerObj.model);
            }
            delete otherPlayers[playerID];
            manageEnemySpawningBasedOnRemotePlayers(); // Re-check after removing a timed-out player
            continue;
        }
        
        // Skip further updates if the model isn't loaded yet
        if (!playerObj.model) {
            continue;
        }
        
        // Track old position to detect actual movement
        const oldPosition = playerObj.model.position.clone();
        
        // Smoothly interpolate to target position/rotation if exists
        if (playerObj.targetPosition) {
            // Only lerp X and Z, keep Y at the fixed value to maintain correct height
            playerObj.model.position.x = THREE.MathUtils.lerp(
                playerObj.model.position.x, 
                playerObj.targetPosition.x, 
                0.2
            );
            playerObj.model.position.z = THREE.MathUtils.lerp(
                playerObj.model.position.z,
                playerObj.targetPosition.z,
                0.2
            );
            // Y position remains fixed at 0.6
            playerObj.model.position.y = 0.6;
        }
        
        // Determine if the model is actually moving for animation
        if (playerObj.targetPosition) {
            // Only check X and Z for movement detection
            const modelPos = new THREE.Vector3(playerObj.model.position.x, 0, playerObj.model.position.z);
            const targetPos = new THREE.Vector3(playerObj.targetPosition.x, 0, playerObj.targetPosition.z);
            
            const wasMoving = playerObj.isMoving;
            
            if (modelPos.distanceToSquared(targetPos) < 0.01) {
                playerObj.isMoving = false; // Close enough to target, consider stopped
                // Stop walking sound when player stops moving
                if (wasMoving && typeof stopSound === 'function') {
                    stopSound('walk');
                }
            } else {
                playerObj.isMoving = true; // Still moving towards target
                // Calculate the actual distance the player has moved since last frame
                const movementDistance = oldPosition.distanceTo(playerObj.model.position);
                
                // Play walking sound if actually moving
                if (movementDistance > 0.05 && typeof playSound === 'function') {
                    playSound('walk', true); // Use the default 'walk' sound for remote players
                }
            }
            
            // Create dust effect when player is moving (and actually changed position)
            if (playerObj.isMoving) {
                const movementDistance = oldPosition.distanceTo(playerObj.model.position);
                if (movementDistance > 0.05) {
                    // Throttle dust effect based on last emission time
                    const currentTime = now;
                    if (!playerObj.lastDustTime || currentTime - playerObj.lastDustTime > 200) { // Emit dust every 200ms while moving
                        playerObj.lastDustTime = currentTime;
                        // Call dust particle function if available
                        if (typeof createPlayerMovementDust === 'function') {
                            // Use the player's color for dust if it exists
                            const playerColor = playerObj.color || 0xd2b48c;
                            createPlayerMovementDust(playerObj.model.position, playerColor);
                        }
                    }
                }
            }
        }
        
        if (playerObj.targetRotationY !== undefined) {
            // Lerp rotation (need to handle wrapping around 2π)
            const currentY = playerObj.model.rotation.y;
            let targetY = playerObj.targetRotationY;
            
            // Find shortest rotation path
            if (Math.abs(targetY - currentY) > Math.PI) {
                if (targetY > currentY) {
                    targetY -= Math.PI * 2;
                } else {
                    targetY += Math.PI * 2;
                }
            }
            
            playerObj.model.rotation.y = THREE.MathUtils.lerp(currentY, targetY, 0.2);
        }
    }
}