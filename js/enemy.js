// Enemy related logic

// Map model creation function keys to actual functions from enemy_types.js
const enemyModelFunctions = {
    createBasicEnemyModel,
    createFastEnemyModel,
    createTankEnemyModel,
    createRangedEnemyModel
};

// Enhanced enemy creation function
function createEnemies(count) {
    for (let i = 0; i < count; i++) {
        // Find an empty spot in the maze
        let gridX, gridZ;
        let distSqToPlayer;
        const actualGridSize = maze.length;
        if (actualGridSize === 0) {
            console.warn("Maze not generated, cannot spawn enemies.");
            return;
        }
        const playerGridX = 1; // Player starts at maze grid (1,1)
        const playerGridZ = 1;
        const minSpawnDistanceSquared = 5 * 5; // Don't spawn too close to player

        do {
            gridX = Math.floor(Math.random() * actualGridSize);
            gridZ = Math.floor(Math.random() * actualGridSize);
            
            if (player && player.position) { // Check if player exists for distance calculation
                 const worldXForDist = gridX * 2 - actualGridSize + 1;
                 const worldZForDist = gridZ * 2 - actualGridSize + 1;
                 distSqToPlayer = Math.pow(worldXForDist - player.position.x, 2) + Math.pow(worldZForDist - player.position.z, 2);
            } else { // If player doesn't exist yet, don't check distance, just ensure it's a path
                distSqToPlayer = minSpawnDistanceSquared + 1; // Ensure it passes distance check
            }

        } while (maze[gridX][gridZ] !== 0 || distSqToPlayer < minSpawnDistanceSquared);

        // Choose enemy type based on current level and random chance
        let enemyTypeName = chooseEnemyType(); // Returns a string like 'BASIC', 'FAST'
        
        // Create enemy based on type
        const enemy = createEnemyOfType(enemyTypeName, gridX, gridZ, actualGridSize);
        if (!enemy) continue; // Skip if enemy creation failed
        
        scene.add(enemy);
        enemies.push(enemy);
    }
}

function chooseEnemyType() {
    // Higher chance for more advanced enemies in higher levels
    const levelFactor = Math.min((currentLevel || 0) / 5, 1); // Caps at level 5, currentLevel from main.js

    const probabilities = {
        BASIC: 0.7 - (0.3 * levelFactor),
        FAST: 0.15 + (0.05 * levelFactor),
        TANK: 0.1 + (0.1 * levelFactor),
        RANGED: 0.05 + (0.15 * levelFactor)
    };
    
    const sum = Object.values(probabilities).reduce((a, b) => a + b, 0);
    for (const key in probabilities) {
        probabilities[key] /= sum;
    }
    
    const random = Math.random();
    let cumulativeProbability = 0;
    
    for (const type in probabilities) {
        cumulativeProbability += probabilities[type];
        if (random <= cumulativeProbability) {
            return type;
        }
    }
    return 'BASIC'; // Fallback
}

function createEnemyOfType(typeName, gridX, gridZ, actualGridSize) {
    const typeData = ENEMY_TYPES[typeName];
    if (!typeData) {
        console.error("Unknown enemy type:", typeName);
        return null;
    }
    
    const modelFunc = enemyModelFunctions[typeData.modelKey];
    if (typeof modelFunc !== 'function') {
        console.error("Model function not found for key:", typeData.modelKey);
        return null;
    }
    const enemyMesh = modelFunc(typeData); // Pass typeData for color etc.
    
    const worldX = gridX * 2 - actualGridSize + 1;
    const worldZ = gridZ * 2 - actualGridSize + 1;
    
    // Adjust Y position based on model. Sphere/Box usually origin at center. Cone origin at base center.
    let posY = ENEMY_SPHERE_RADIUS; // Default for sphere-like base
    if (typeName === 'TANK') posY = (ENEMY_SPHERE_RADIUS * 1.5) / 2; // Tank is Box, origin at center
    // Ranged group origin is at its base sphere's center.
    
    enemyMesh.position.set(worldX, posY, worldZ);
    enemyMesh.castShadow = true;
    enemyMesh.receiveShadow = true;
    
    const healthBarGeometry = new THREE.PlaneGeometry(...ENEMY_HEALTH_BAR_GEOMETRY_ARGS);
    const healthBarMaterial = new THREE.MeshBasicMaterial({ color: ENEMY_HEALTH_BAR_COLOR, side: THREE.DoubleSide });
    const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
    
    // Adjust health bar Y offset based on enemy type/size
    let healthBarYOffset = ENEMY_HEALTH_BAR_Y_OFFSET; // Default from config
    if (typeName === 'TANK') healthBarYOffset = (ENEMY_SPHERE_RADIUS * 1.5) / 2 + 0.3;
    else if (typeName === 'FAST') healthBarYOffset = ENEMY_SPHERE_RADIUS + 0.3; // Cone height is 2*radius
    else if (typeName === 'RANGED') healthBarYOffset = ENEMY_SPHERE_RADIUS * 0.8 + 0.3; // Top of base sphere + offset


    healthBar.position.y = healthBarYOffset;
    enemyMesh.add(healthBar);
    
    enemyMesh.enemyType = typeName;
    enemyMesh.health = typeData.healthFactor * ENEMY_HEALTH_INITIAL;
    enemyMesh.maxHealth = typeData.healthFactor * ENEMY_HEALTH_INITIAL;
    enemyMesh.speed = typeData.speedFactor * ENEMY_MOVE_SPEED;
    enemyMesh.damage = typeData.damageFactor * ENEMY_ATTACK_DAMAGE_PER_SECOND;
    enemyMesh.points = typeData.points;
    enemyMesh.healthBar = healthBar;
    
    enemyMesh.specialAbility = typeData.specialAbility;
    if (enemyMesh.specialAbility === 'shoot') {
        enemyMesh.lastShotTime = 0;
        enemyMesh.shootCooldown = typeData.shootCooldown;
        enemyMesh.shootRange = typeData.shootRange;
    }
    
    addEnemyNameLabel(enemyMesh, typeData.name);
    return enemyMesh;
}

function addEnemyNameLabel(enemy, name) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    context.font = 'bold 20px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.strokeText(name, 128, 40);
    context.fillText(name, 128, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9 });
    const sprite = new THREE.Sprite(material);

    let labelYOffset = ENEMY_SPHERE_RADIUS * 1.5; // Default
    if (enemy.enemyType === 'TANK') labelYOffset = (ENEMY_SPHERE_RADIUS * 1.5) * 0.5 + 0.8;
    else if (enemy.enemyType === 'FAST') labelYOffset = ENEMY_SPHERE_RADIUS * 1.0 + 0.5; // Above cone tip
    else if (enemy.enemyType === 'RANGED') labelYOffset = ENEMY_SPHERE_RADIUS * 1.5 + 0.5; // Above antenna

    sprite.position.y = labelYOffset;
    sprite.scale.set(2, 0.5, 1); // Wider label
    
    enemy.add(sprite);
    enemy.nameSprite = sprite;
    sprite.visible = false;
}

function updateEnemies(delta) {
    for (let i = enemies.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
        const enemy = enemies[i];
        if (!enemy || !player || !player.position) continue; // Basic safety checks

        const distanceToPlayer = enemy.position.distanceTo(player.position);
        
        if (enemy.nameSprite) {
            enemy.nameSprite.visible = distanceToPlayer < ENEMY_DETECTION_RANGE / 1.5;
            // Make sprite always face camera (simplified billboard)
            if (camera) enemy.nameSprite.quaternion.copy(camera.quaternion);
        }
        
        if (enemy.enemyType === 'RANGED' && enemy.userData.antennaTop) {
            const antennaTop = enemy.userData.antennaTop;
            antennaTop.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 5) * 0.2);
            antennaTop.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 5) * 0.3;
        }
        
        if (enemy.enemyType === 'FAST' && enemy.model && enemy.model.rotation) { // Assuming model is the cone mesh
             // Fast enemies might spin or have other visual cues
        }
        
        if (distanceToPlayer < ENEMY_DETECTION_RANGE) {
            const directionToPlayer = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
            
            if (enemy.specialAbility === 'shoot' && distanceToPlayer < enemy.shootRange) {
                const currentTime = clock.getElapsedTime();
                if (currentTime - (enemy.lastShotTime || 0) > enemy.shootCooldown) {
                    enemy.lastShotTime = currentTime;
                    const raycaster = new THREE.Raycaster(enemy.position.clone(), directionToPlayer);
                    const intersects = raycaster.intersectObjects(walls);
                    if (intersects.length === 0 || intersects[0].distance > distanceToPlayer) {
                        createEnemyProjectile(enemy, directionToPlayer); // From enemy_types.js
                    }
                }
                if (distanceToPlayer < ENEMY_ATTACK_RANGE * 2) { // Ranged enemies try to keep distance
                    moveEnemy(enemy, directionToPlayer.clone().negate(), delta);
                } else if (enemy.enemyType === 'RANGED') { // Aim but don't move closer if not too close
                     enemy.lookAt(player.position);
                }
            } else {
                const raycaster = new THREE.Raycaster(enemy.position.clone(), directionToPlayer);
                const intersects = raycaster.intersectObjects(walls);
                if (intersects.length === 0 || intersects[0].distance > distanceToPlayer) {
                    moveEnemy(enemy, directionToPlayer, delta);
                    if (distanceToPlayer < ENEMY_ATTACK_RANGE) { // Melee attack
                        if (playerShieldActive) {
                            playerHealth -= (enemy.damage * 0.25) * delta;
                        } else {
                            playerHealth -= enemy.damage * delta;
                        }
                    }
                }
            }
        }
        
        if (enemy.healthBar && camera) {
            enemy.healthBar.lookAt(camera.position);
        }
    }
}

function moveEnemy(enemy, direction, delta) {
    const desiredMove = direction.clone().multiplyScalar(delta * enemy.speed);
    const originalPosition = enemy.position.clone();
    let allowedMove = desiredMove.clone();

    enemy.position.x += desiredMove.x;
    for (const wall of walls) {
        const dx = enemy.position.x - wall.position.x;
        const dz = originalPosition.z - wall.position.z; // Check against original Z for X move
        if (Math.abs(dx) < ENEMY_WALL_COLLISION_THRESHOLD && Math.abs(dz) < ENEMY_WALL_COLLISION_THRESHOLD) {
            enemy.position.x = originalPosition.x;
            allowedMove.x = 0;
            break;
        }
    }

    enemy.position.z += desiredMove.z;
    for (const wall of walls) {
        const dx = enemy.position.x - wall.position.x; // Check against potentially new X for Z move
        const dz = enemy.position.z - wall.position.z;
        if (Math.abs(dx) < ENEMY_WALL_COLLISION_THRESHOLD && Math.abs(dz) < ENEMY_WALL_COLLISION_THRESHOLD) {
            enemy.position.z = originalPosition.z;
            allowedMove.z = 0;
            break;
        }
    }
    
    enemy.position.copy(originalPosition).add(allowedMove);
    
    if (enemy.enemyType !== 'RANGED' && allowedMove.lengthSq() > 0.0001) {
        const lookTargetPos = new THREE.Vector3().addVectors(enemy.position, allowedMove);
        if (enemy.enemyType === 'FAST' && enemy.children.length > 0 && enemy.children[0] instanceof THREE.Mesh) {
            // Fast enemy (cone) should point its tip. Its local Z is forward.
            // We need to rotate the parent group.
             enemy.lookAt(lookTargetPos);
        } else if (enemy.enemyType !== 'FAST') {
             enemy.lookAt(lookTargetPos);
        }
    }
}

function removeAllEnemies() {
    if (scene && enemies && enemies.length > 0) {
        console.log("Removing all enemies. Count:", enemies.length);
        enemies.forEach(enemy => {
            if (enemy.parent) { // Ensure it's still in a scene graph
                scene.remove(enemy);
            }
            // Optional: Dispose geometry/material if they are unique per enemy and not shared
            // if (enemy.geometry) enemy.geometry.dispose();
            // if (enemy.material) enemy.material.dispose();
            // if (enemy.healthBar && enemy.healthBar.geometry) enemy.healthBar.geometry.dispose();
            // if (enemy.healthBar && enemy.healthBar.material) enemy.healthBar.material.dispose();
            // if (enemy.nameSprite && enemy.nameSprite.material && enemy.nameSprite.material.map) enemy.nameSprite.material.map.dispose();
            // if (enemy.nameSprite && enemy.nameSprite.material) enemy.nameSprite.material.dispose();
        });
        enemies.length = 0; // Clear the array
    } else {
        // console.log("removeAllEnemies: No enemies to remove or scene/enemies array not available.");
    }
}