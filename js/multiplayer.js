// Multiplayer functionality using Photon

// Global variables for multiplayer
let photon;
let otherPlayers = {}; // Map of playerID -> player object
let localPlayerID = null;

// Player model for other players (visible to others)
function createPlayerModel() {
    const playerGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x2288ff });
    const playerModel = new THREE.Mesh(playerGeometry, playerMaterial);
    
    // Add a head to make direction visible
    const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.6);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x22aaff });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.7, 0.2);
    playerModel.add(head);
    
    // Make player cast shadow
    playerModel.castShadow = true;
    playerModel.receiveShadow = true;
    return playerModel;
}

// Initialize Photon connection
function initializeMultiplayer() {
    // Protocol 0 for WS (WebSocket) since game is on http://localhost
    // Protocol 1 for WSS (Secure WebSocket)
    photon = new Photon.LoadBalancing.LoadBalancingClient(0, "a3478f4a-f2cb-4eb1-aa07-d3427e6b93fd", "1.0");
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
    console.log("onJoinRoom: localPlayerID set to:", localPlayerID, "My Actor:", photon.myActor());

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
                    const playerModel = createPlayerModel();
                    // Set a distinct initial position for these pre-existing players for debugging
                    playerModel.position.set(existingPlayerID * 2, 0.9, -7); // Offset by actorNr, further back
                    scene.add(playerModel);
                    otherPlayers[existingPlayerID] = { model: playerModel, lastUpdate: Date.now() };
                    console.log(`onJoinRoom: Created and stored model for existing remote player ${existingPlayerID}.`);
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
    
    // Maze logic temporarily disabled for simple plane testing
    // if (photon.myActor().actorNr === 1) { // Player 1 is the host
    //     console.log("Local player is Player 1. Generating and sending maze.");
    //     generateMaze();    // Generate the maze data
    //     createMazeWalls(); // Build it locally
    //     sendMazeData();    // Send it to others
    // } else {
    //     console.log("Local player is not Player 1. Will wait for maze data.");
    // }
    setLocalPlayerInitialPosition(); // Set player position (will be updated for different spawns)
}

/*
// Send maze data to all players - Temporarily disabled
function sendMazeData() {
    if (!maze || maze.length === 0 || !photon.isJoinedToRoom()) {
        console.warn("sendMazeData: Maze not generated or not in room.");
        return;
    }
    
    photon.raiseEvent(1, {
        maze: maze
    });
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
    // Create player model
    const playerModel = createPlayerModel();
    // Set a test initial position for the remote player model
    playerModel.position.set(0, 0.9, -5); // X=0, Y=0.9 (on floor), Z=-5 (in front of default camera)
    scene.add(playerModel);
    console.log(`onPlayerJoin: Added player model for remote actorNr ${playerID} to scene at initial test position:`, playerModel.position);
    
    // Store player
    otherPlayers[playerID] = {
        model: playerModel,
        lastUpdate: Date.now()
    };
    console.log(`onPlayerJoin: Stored remote player ${playerID} in otherPlayers:`, otherPlayers[playerID]);
    
    // If I'm player 1, send maze data to new players - Temporarily disabled
    // Player 1 already sent maze onJoinRoom. If a new player joins later,
    // player 1 should resend the maze data to ensure the new player gets it.
    /*
    if (photon.myActor().actorNr === 1) {
        console.log("Player 1 sending maze data to newly joined player:", playerID);
        sendMazeData();
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
        /*
        case 1: // Maze data - Temporarily disabled
            if (content.maze) {
                console.log("Received maze data from actor:", actorNr);
                clearMazeWalls(); // Clear any existing walls first
                maze = content.maze; // Update local maze variable
                createMazeWalls();   // Build the new maze
                setLocalPlayerInitialPosition(); // Set player position now that maze exists
            } else {
                console.warn("Received event 1 (maze data) but content.maze is missing.");
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
    if (data.position) {
        // Create target position if it doesn't exist
        if (!playerObj.targetPosition) {
            playerObj.targetPosition = new THREE.Vector3(
                data.position.x,
                data.position.y,
                data.position.z
            );
        } else {
            // Update target
            playerObj.targetPosition.set(data.position.x, data.position.y, data.position.z);
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
            continue;
        }
        
        // Smoothly interpolate to target position/rotation if exists
        if (playerObj.targetPosition) {
            // Lerp position
            playerObj.model.position.lerp(playerObj.targetPosition, 0.2);
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