// Power-ups and collectible items

// Assumes POWERUP_TYPES is defined in config.js
// Assumes global variables: scene, player, powerUps, playerShieldMesh, powerUpSpawnTimer,
// playerSpeedBoostActive, playerShieldActive, maze, clock,
// PLAYER_HEALTH_INITIAL, currentPlayerSpeed (instead of direct PLAYER_SPEED modification),
// currentWeaponLevel, WEAPON_TYPES.
// Assumes functions: updateScoreDisplay, playSound, showNotification, updateWeaponDisplay (to be added to ui.js or similar)

function createPowerUp(type, position) {
    const powerUpData = POWERUP_TYPES[type];
    if (!powerUpData) {
        console.error("Unknown power-up type:", type);
        return null;
    }

    const powerUpGeometry = new THREE.OctahedronGeometry(0.3, 0);
    const powerUpMaterial = new THREE.MeshStandardMaterial({
        color: powerUpData.color,
        emissive: powerUpData.color,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });

    const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
    powerUp.position.copy(position);
    powerUp.position.y = 0.5; // Float above ground
    powerUp.powerUpType = type;
    powerUp.rotationSpeed = 0.02 + Math.random() * 0.02;
    powerUp.floatSpeed = 0.01 + Math.random() * 0.01; // Not used in provided updatePowerUps, but kept
    powerUp.floatHeight = 0.2;
    powerUp.baseY = powerUp.position.y;
    powerUp.floatOffset = Math.random() * Math.PI * 2;

    scene.add(powerUp);
    powerUps.push(powerUp);

    // Add particle effect around the power-up
    createPowerUpParticles(powerUp);

    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (powerUps.includes(powerUp)) {
            const index = powerUps.indexOf(powerUp);
            if (index > -1) {
                powerUps.splice(index, 1);
                scene.remove(powerUp);
                // Also remove particles if they are children
                powerUp.children.filter(child => child instanceof THREE.Points).forEach(particleSystem => {
                    powerUp.remove(particleSystem); // Or scene.remove if particles were added to scene directly
                });
            }
        }
    }, 30000);

    return powerUp;
}

function spawnRandomPowerUp() {
    // Only spawn if we have fewer than 3 power-ups
    if (powerUps.length >= 3) return;

    // Find an empty spot in the maze
    let gridX, gridZ;
    let distSqToPlayer; // Renamed from distSq to be specific
    const actualGridSize = maze.length;
    if (actualGridSize === 0) return; // Maze not generated yet

    do {
        gridX = Math.floor(Math.random() * actualGridSize);
        gridZ = Math.floor(Math.random() * actualGridSize);

        // Convert grid coords to world coords for distance check
        const worldX = gridX * 2 - actualGridSize + 1;
        const worldZ = gridZ * 2 - actualGridSize + 1;
        if (player && player.position) { // Check if player exists
             distSqToPlayer = Math.pow(worldX - player.position.x, 2) + Math.pow(worldZ - player.position.z, 2);
        } else {
            distSqToPlayer = Infinity; // If player doesn't exist, don't worry about distance
        }


    } while (maze[gridX][gridZ] !== 0 || distSqToPlayer < 25); // Must be on path and not too close to player (5 world units)

    // Convert grid coords to world coords for spawning
    const spawnWorldX = gridX * 2 - actualGridSize + 1;
    const spawnWorldZ = gridZ * 2 - actualGridSize + 1;

    // Pick random power-up type
    const powerUpTypeKeys = Object.keys(POWERUP_TYPES);
    if (powerUpTypeKeys.length === 0) return; // No power-up types defined
    const randomType = powerUpTypeKeys[Math.floor(Math.random() * powerUpTypeKeys.length)];

    createPowerUp(randomType, new THREE.Vector3(spawnWorldX, 0.5, spawnWorldZ));
}

function updatePowerUps(delta) {
    // Animate existing power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];

        // Rotate power-up
        powerUp.rotation.y += powerUp.rotationSpeed;

        // Bob up and down using global powerUpSpawnTimer for consistent bobbing phase
        powerUp.position.y = powerUp.baseY + Math.sin(powerUpSpawnTimer + powerUp.floatOffset) * powerUp.floatHeight;

        // Animate particles if they exist and have orbit data
        powerUp.children.forEach(child => {
            if (child instanceof THREE.Points && child.userData.orbit) {
                child.userData.orbitAngle += child.userData.orbitSpeed;
                child.rotation.y = child.userData.orbitAngle;
            }
        });


        // Check for collision with player
        if (player && player.position) { // Check if player exists
            const distanceToPlayer = powerUp.position.distanceTo(player.position);
            if (distanceToPlayer < 1.2) { // Collision threshold
                const powerUpData = POWERUP_TYPES[powerUp.powerUpType];
                if (powerUpData && powerUpData.effect) {
                    powerUpData.effect(player); // Pass player object to effect
                }

                if (typeof playSound === 'function') playSound('powerup');

                scene.remove(powerUp);
                // Also remove particles
                powerUp.children.filter(c => c instanceof THREE.Points).forEach(p => powerUp.remove(p));
                powerUps.splice(i, 1);

                if (typeof showNotification === 'function' && powerUpData) {
                    showNotification(`${powerUpData.name} collected!`);
                }
            }
        }
    }

    // Update spawn timer (assuming powerUpSpawnTimer is a global in main.js, incremented there)
    // powerUpSpawnTimer += delta; // This should be done in main.js animate loop

    // Spawn new power-ups periodically
    if (Math.random() < 0.005) { // Adjust chance as needed
        spawnRandomPowerUp();
    }
}

function createShieldEffect() {
    if (playerShieldMesh) { // playerShieldMesh is global
        player.remove(playerShieldMesh); // Assuming it's a child of player
        playerShieldMesh = null;
    }

    const shieldGeometry = new THREE.SphereGeometry(1.5, 16, 16); // Shield radius
    const shieldMaterial = new THREE.MeshBasicMaterial({
        color: POWERUP_TYPES.SHIELD ? POWERUP_TYPES.SHIELD.color : 0x8844ff, // Fallback color
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    playerShieldMesh = new THREE.Mesh(shieldGeometry, shieldMaterial);
    if (player) player.add(playerShieldMesh); // Add to player so it moves with player
}

function createPowerUpParticles(powerUp) {
    // Create a simple particle system around the power-up
    const particleCount = 8;
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.5;
        particlePositions[i * 3] = Math.cos(angle) * radius;
        particlePositions[i * 3 + 1] = 0; // Centered around powerup's y=0
        particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const powerUpData = POWERUP_TYPES[powerUp.powerUpType];
    const particleColor = powerUpData ? powerUpData.color : 0xffffff;

    const particleMaterial = new THREE.PointsMaterial({
        color: particleColor,
        size: 0.1,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending, // For a brighter effect
        depthWrite: false // Particles don't obscure each other as much
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    powerUp.add(particles); // Add particles as a child of the power-up

    // Make particles orbit around the power-up
    particles.userData.orbit = true;
    particles.userData.orbitSpeed = (Math.random() * 0.02 + 0.01) * (Math.random() < 0.5 ? 1 : -1); // Random speed and direction
    particles.userData.orbitAngle = Math.random() * Math.PI * 2; // Random start angle
}