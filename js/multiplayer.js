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
    photon = new Photon.LoadBalancing.LoadBalancingClient(1, "a3478f4a-f2cb-4eb1-aa07-d3427e6b93fd", "1.0");
    
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
    console.log("Photon state changed:", state);
    
    switch (state) {
        case Photon.LoadBalancing.LoadBalancingClient.State.ConnectedToMaster:
            // Join or create room named "MazeShooterRoom"
            photon.joinRoom("MazeShooterRoom", { createIfNotExists: true });
            break;
    }
}

// Callback when local player joins a room
function onJoinRoom() {
    console.log("Joined room:", photon.currentRoom.name);
    localPlayerID = photon.myActor().actorNr;
    
    // Send initial maze state to ensure all players have the same maze
    if (photon.myActor().actorNr === 1) { // Only first player sends the maze
        sendMazeData();
    }
}

// Send maze data to all players
function sendMazeData() {
    if (!maze || !photon.isJoinedToRoom()) return;
    
    photon.raiseEvent(1, {
        maze: maze
    });
}

// Callback when another player joins
function onPlayerJoin(actor) {
    const playerID = actor.actorNr;
    console.log("Player joined:", playerID);
    
    // Don't create model for local player
    if (playerID === localPlayerID) return;
    
    // Create player model
    const playerModel = createPlayerModel();
    // Set a test initial position for the remote player model
    playerModel.position.set(0, 0.9, -5); // X=0, Y=0.9 (on floor), Z=-5 (in front of default camera)
    scene.add(playerModel);
    console.log(`Added player model for ${playerID} at initial test position:`, playerModel.position);
    
    // Store player
    otherPlayers[playerID] = {
        model: playerModel,
        lastUpdate: Date.now()
    };
    
    // If I'm player 1, send maze data to new players
    if (photon.myActor().actorNr === 1) {
        sendMazeData();
    }
}

// Callback when another player leaves
function onPlayerLeave(actor) {
    const playerID = actor.actorNr;
    console.log("Player left:", playerID);
    
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
        case 1: // Maze data
            if (content.maze && maze.length === 0) {
                // Only accept maze if we don't have one already
                maze = content.maze;
                createMazeWalls(); // Rebuild walls with new maze data
            }
            break;
            
        case 2: // Player state update
            updateRemotePlayerState(actorNr, content);
            break;
            
        case 3: // Shooting
            handleRemotePlayerShoot(content);
            break;
    }
}

// Update another player's state
function updateRemotePlayerState(playerID, data) {
    if (!otherPlayers[playerID]) return;
    
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