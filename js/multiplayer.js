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
    for (const id in otherPlayers) {
        // Consider a player alive if HP is not explicitly 0 or less.
        // If hp is undefined, assume they are alive until first update.
        if (otherPlayers[id] && (typeof otherPlayers[id].hp === 'undefined' || otherPlayers[id].hp > 0)) {
            aliveRemotePlayers++;
        }
    }

    // console.log(`manageEnemySpawning: Found ${aliveRemotePlayers} alive remote players. Current enemy count: ${enemies.length}`);

    if (aliveRemotePlayers === 0) {
        // No alive remote players, ensure local enemies are present
        if (enemies.length === 0) {
            // Ensure maze is ready before attempting to create enemies
            if (typeof maze !== 'undefined' && maze.length > 0) {
                console.log("manageEnemySpawning: No alive remote players and no local enemies. Maze ready. Spawning enemies.");
                createEnemies(ENEMY_COUNT);
            } else {
                console.warn("manageEnemySpawning: No alive remote players, no local enemies, but MAZE IS NOT READY. Cannot spawn enemies yet.");
            }
        } else {
            // console.log("manageEnemySpawning: No alive remote players, local enemies already present.");
        }
    } else {
        // One or more alive remote players, ensure local enemies are removed
        if (enemies.length > 0) {
            console.log("manageEnemySpawning: Alive remote players present. Removing local enemies.");
            removeAllEnemies();
        } else {
            // console.log("manageEnemySpawning: Alive remote players present, no local enemies to remove.");
        }
    }
}

// Player model for other players (visible to others) - Now uses createRobotPlayerModel
// The old createPlayerModel function is replaced by the one in js/player_model.js
// We'll call createRobotPlayerModel directly where createPlayerModel was called.
// function createPlayerModel(color) { ... } // This function is now removed/commented

// Initialize Photon connection
function initializeMultiplayer() {
    // Protocol 0 for WS (WebSocket) since game is on http://localhost
    // Protocol 1 for WSS (Secure WebSocket)
    photon = new Photon.LoadBalancing.LoadBalancingClient(1, "a3478f4a-f2cb-4eb1-aa07-d3427e6b93fd", "1.0");
    console.log("Photon client initialized with protocol 0 (WS). AppId: a3478f4a-f2cb-4eb1-aa07-d3427e6b93fd, AppVersion: 1.0");
    
    // Set callbacks
    photon.onStateChange = onStateChange;
    photon.onJoinRoom = onJoinRoom;
    photon.onActorJoin = onPlayerJoin;
    photon.onActorLeave = onPlayerLeave;
    photon.onEvent = onEvent;
    
    // Connect to Photon server
    photon.connectToRegionMaster("us");
    
    // Setup broadcast interval
    setInterval(broadcastPlayerState, 100); // Send position update 10 times per second
}

// Callback when the connection state changes
function onStateChange(state) {
    console.log("Photon state changed:", state); // Removed StateToName for compatibility
    
    switch (state) {
        case Photon.LoadBalancing.LoadBalancingClient.State.ConnectedToMaster:
            // Join or create room named "MazeShooterRoom"
            photon.joinRoom("MazeShooterRoom", { createIfNotExists: true });
            break;
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
                    // Use the new robot model creation function
                    const playerModel = createRobotPlayerModel(Math.random() * 0xffffff); // Assign a random color
                    // The model's origin is at its base. Position it so its base is on the "floor" (y=0)
                    // The logical player position in data.position.y is eye level.
                    // For the model itself, we want its base on the ground.
                    // The createRobotPlayerModel is built with its base at y=0 of its local group.
                    // The player's logical height is PLAYER_EYE_LEVEL (e.g. 1.6).
                    // The model's height is ~1.6.
                    // We set the model's y position to 0, as its internal geometry is built upwards from y=0.
                    playerModel.position.set(existingPlayerID * 2, 0, -7); // Offset by actorNr, further back, Y=0 for base on ground
                    scene.add(playerModel);
                    otherPlayers[existingPlayerID] = {
                        model: playerModel,
                        lastUpdate: Date.now(),
                        // Initialize targetPosition to current model position to avoid jump
                        targetPosition: playerModel.position.clone(),
                        targetRotationY: playerModel.rotation.y,
                        isMoving: false // For animation
                    };
                    console.log(`onJoinRoom: Created and stored ROBOT model for existing remote player ${existingPlayerID}.`);
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

// Callback when another player joins
function onPlayerJoin(actor) {
    const playerID = actor.actorNr;
    console.log(`onPlayerJoin: Event for actorNr ${playerID}. My localPlayerID is ${localPlayerID}. Actor details:`, actor);

    if (playerID === localPlayerID) {
        console.log(`onPlayerJoin: actorNr ${playerID} is local player. No remote model created.`);
        return;
    }
    
    console.log(`onPlayerJoin: actorNr ${playerID} is a remote player. Creating model.`);
    // Create player model using the new function
    const playerModel = createRobotPlayerModel(Math.random() * 0xffffff); // Assign a random color
    // Position model with its base on the ground (y=0)
    playerModel.position.set(0, 0, -5); // Initial test position, Y=0 for base on ground
    scene.add(playerModel);
    console.log(`onPlayerJoin: Added ROBOT player model for remote actorNr ${playerID} to scene at initial test position:`, playerModel.position);
    
    // Store player
    otherPlayers[playerID] = {
        model: playerModel,
        lastUpdate: Date.now(),
        // Initialize targetPosition to current model position
        targetPosition: playerModel.position.clone(),
        targetRotationY: playerModel.rotation.y,
        isMoving: false // For animation
    };
    console.log(`onPlayerJoin: Stored remote player ${playerID} in otherPlayers:`, otherPlayers[playerID]);
    
    manageEnemySpawningBasedOnRemotePlayers();
    
    // No need to send maze data for static mazes.
    /*
    if (typeof DRAW_MAZE !== 'undefined' && DRAW_MAZE && photon.myActor().actorNr === 1) {
        // This logic is obsolete for static mazes.
        // console.log(`Player 1 sending maze data to newly joined player: ${playerID}`);
        // sendMazeData();
    }
    */
}

// Callback when another player leaves
function onPlayerLeave(actor) {
    const playerID = actor.actorNr;
    console.log(`onPlayerLeave: Player ${playerID} left. LocalPlayerID: ${localPlayerID}. Actor details:`, actor);
    
    if (otherPlayers[playerID]) {
        scene.remove(otherPlayers[playerID].model);
        delete otherPlayers[playerID];
        
        manageEnemySpawningBasedOnRemotePlayers();
    }
}

// Broadcast player state (position, rotation)
function broadcastPlayerState() {
    if (!photon.isJoinedToRoom() || !player) return;
    
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
        hp: playerHealth
    });
}

// Handle shooting in multiplayer
function shootMultiplayer() {
    // First do the local shooting logic
    shoot();
    
    // Then notify others
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
        case 2: // Player state update
            updateRemotePlayerState(actorNr, content); // actorNr here is the sender of the state
            break;
            
        case 3: // Shooting
            handleRemotePlayerShoot(content); // content here is { position, direction }
            break;

        case 4: // Player hit
            if (content && typeof content.victimActorNr === 'number') {
                const victimID = content.victimActorNr;
                console.log(`onEvent: Received event 4 (player_hit). Victim: ${victimID}, Event sent by: ${actorNr}`);
                if (victimID === localPlayerID) {
                    // This client's local player was hit
                    playerHealth -= BULLET_DAMAGE; // BULLET_DAMAGE from config.js
                    console.log(`onEvent: Local player (ID: ${localPlayerID}) hit. New health: ${playerHealth}`);
                    if (playerHealth <= 0) {
                        console.log("Local player died.");
                        // Call gameOver or similar function if it exists and is appropriate here
                        // For now, just log. Consider if gameOver() should be callable from here.
                        // gameOver(); // Potentially from ui.js or main.js
                    }
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
            handleRemotePlayerShoot(content);
            break;
    }
}

// Update another player's state
function updateRemotePlayerState(playerID, data) {
    if (!otherPlayers[playerID] || playerID === localPlayerID) {
        // Do not update if player doesn't exist in otherPlayers OR if it's an event for the local player
        if (playerID === localPlayerID) {
            // This case should ideally be caught by the onEvent check `if (actorNr === localPlayerID) return;`
            // but this is an additional safeguard.
            // console.log(`updateRemotePlayerState: Attempted to update localPlayerID ${playerID}. Skipping.`);
        }
        return;
    }
    
    const playerObj = otherPlayers[playerID];
    playerObj.lastUpdate = Date.now();
    
    // Update position and rotation with lerping
    let wasMoving = playerObj.isMoving;
    playerObj.isMoving = false; // Assume not moving unless position changes significantly

    if (data.position) {
        const newTargetPos = new THREE.Vector3(data.position.x, 0, data.position.z); // Y is 0 for base on ground
        
        if (!playerObj.targetPosition) {
            playerObj.targetPosition = newTargetPos.clone();
            playerObj.model.position.copy(newTargetPos); // Snap to first position
        } else {
            // Check if position changed enough to be considered moving
            if (playerObj.targetPosition.distanceToSquared(newTargetPos) > 0.001) {
                 playerObj.isMoving = true;
            }
            playerObj.targetPosition.copy(newTargetPos);
        }
    }
    
    if (data.rotation) {
        playerObj.targetRotationY = data.rotation.y;
    }
    if (typeof data.hp === 'number') {
        // Update our conceptual health for this remote player
        // This is mainly for display purposes if we had health bars for others.
        // The actual authority on health is the client owning that player.
        if (!playerObj.hp || playerObj.hp !== data.hp) {
             playerObj.hp = data.hp;
             console.log(`updateRemotePlayerState: Updated remote player ${playerID} conceptual HP to: ${playerObj.hp}`);
             // If a player's HP was updated (especially if it dropped to 0), re-evaluate enemy spawning
             manageEnemySpawningBasedOnRemotePlayers();
        }
    }
}

// Handle remote player shooting
function handleRemotePlayerShoot(data) {
    if (!scene) return;
    
    const bulletGeometry = new THREE.SphereGeometry(...BULLET_GEOMETRY_ARGS);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: BULLET_COLOR });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Position bullet at shooter's position
    bullet.position.set(data.position.x, data.position.y, data.position.z);
    
    // Set velocity from direction
    const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
    bullet.velocity = direction.multiplyScalar(BULLET_SPEED);
    bullet.alive = true;
    
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

// Update other players' visuals (called from animate loop)
function updateOtherPlayers(delta) {
    const now = Date.now();
    
    for (const playerID in otherPlayers) {
        const playerObj = otherPlayers[playerID];
        console.log(`[updateOtherPlayers] Processing player ${playerID}. Model:`, playerObj.model, 'Target Pos:', playerObj.targetPosition, 'Target RotY:', playerObj.targetRotationY);
        
        // Remove players who haven't updated in 5 seconds
        if (now - playerObj.lastUpdate > 5000) {
            scene.remove(playerObj.model);
            delete otherPlayers[playerID];
            manageEnemySpawningBasedOnRemotePlayers(); // Re-check after removing a timed-out player
            continue;
        }
        
        // Smoothly interpolate to target position/rotation if exists
        if (playerObj.targetPosition) {
            playerObj.model.position.lerp(playerObj.targetPosition, 0.2); // Interpolate Y as well, should be 0
        }
        
        // Determine if the model is actually moving for animation
        // Compare current model position to its target. If very close, it might have stopped.
        if (playerObj.targetPosition && playerObj.model.position.distanceToSquared(playerObj.targetPosition) < 0.01) {
            playerObj.isMoving = false; // Close enough to target, consider stopped
        } else if (playerObj.targetPosition) {
            playerObj.isMoving = true; // Still moving towards target
        }


        if (playerObj.model.userData && typeof animateRobotPlayerWalk === 'function') {
            playerObj.model.userData.isMoving = playerObj.isMoving; // Update animation flag
            animateRobotPlayerWalk(playerObj.model, delta);
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