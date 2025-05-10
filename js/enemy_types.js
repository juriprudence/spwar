// Enhanced enemies with different types and behaviors

// Assumes ENEMY_TYPES is defined in config.js
// Assumes ENEMY_HEALTH_INITIAL, ENEMY_MOVE_SPEED, ENEMY_ATTACK_DAMAGE_PER_SECOND,
// ENEMY_SPHERE_RADIUS, ENEMY_GEOMETRY_ARGS (for basic), ENEMY_HEALTH_BAR_GEOMETRY_ARGS,
// ENEMY_HEALTH_BAR_COLOR, ENEMY_HEALTH_BAR_Y_OFFSET, ENEMY_DETECTION_RANGE,
// ENEMY_ATTACK_RANGE, ENEMY_WALL_COLLISION_THRESHOLD are in config.js.
// Assumes global: scene, enemies, maze, player, walls, clock, currentLevel (from main.js),
// enemyProjectiles (to be declared in main.js).
// Assumes functions: playSound, createHitEffect (to be added).

// Create different enemy models
function createBasicEnemyModel(typeData) {
    // Basic enemy uses the ENEMY_GEOMETRY_ARGS (sphere) from config.js
    const enemyGeometry = new THREE.SphereGeometry(...ENEMY_GEOMETRY_ARGS);
    const enemyMaterial = new THREE.MeshStandardMaterial({
        color: typeData.color, // Use color from typeData
        roughness: 0.7
    });
    return new THREE.Mesh(enemyGeometry, enemyMaterial);
}

function createFastEnemyModel(typeData) {
    const enemyGeometry = new THREE.ConeGeometry(ENEMY_SPHERE_RADIUS, ENEMY_SPHERE_RADIUS * 2, 8);
    const enemyMaterial = new THREE.MeshStandardMaterial({
        color: typeData.color,
        roughness: 0.3,
        metalness: 0.5
    });
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    enemy.rotation.x = Math.PI / 2; // Rotate to point forward
    return enemy;
}

function createTankEnemyModel(typeData) {
    const enemyGeometry = new THREE.BoxGeometry(
        ENEMY_SPHERE_RADIUS * 1.5,
        ENEMY_SPHERE_RADIUS * 1.5,
        ENEMY_SPHERE_RADIUS * 1.5
    );
    const enemyMaterial = new THREE.MeshStandardMaterial({
        color: typeData.color,
        roughness: 0.9,
        metalness: 0.7
    });
    return new THREE.Mesh(enemyGeometry, enemyMaterial);
}

function createRangedEnemyModel(typeData) {
    const group = new THREE.Group();
    const baseRadius = ENEMY_SPHERE_RADIUS * 0.8;

    const baseGeometry = new THREE.SphereGeometry(baseRadius, 16, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: typeData.color,
        emissive: typeData.color,
        emissiveIntensity: 0.3
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    group.add(base);

    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, baseRadius * 1.5); // Adjusted length
    const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.y = baseRadius * 0.75; // Position relative to base center
    group.add(antenna);

    const topGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const topMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.8
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = baseRadius * 1.5; // Position at the top of the antenna
    group.add(top);

    group.userData.antennaTop = top;
    return group;
}

function createEnemyProjectile(enemy, direction) {
    const projectileGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Consider making this configurable per enemy type
        emissive: 0xffff00,
        emissiveIntensity: 1.0
    });

    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectile.position.copy(enemy.position);
    // Adjust Y if enemy model origin isn't at its visual center for shooting
    projectile.position.y = enemy.position.y; // Assume enemy.position.y is its center for sphere/tank, adjust for cone/ranged if needed

    const light = new THREE.PointLight(0xffff00, 1, 3);
    projectile.add(light);

    projectile.velocity = direction.clone().multiplyScalar(10); // Projectile speed
    projectile.damage = enemy.damage * 0.5; // Example damage scaling
    projectile.isEnemyProjectile = true;

    scene.add(projectile);
    enemyProjectiles.push(projectile); // enemyProjectiles is global

    if (typeof playSound === 'function') playSound('enemyShoot');

    setTimeout(() => {
        if (enemyProjectiles.includes(projectile)) {
            const index = enemyProjectiles.indexOf(projectile);
            if (index > -1) {
                enemyProjectiles.splice(index, 1);
                scene.remove(projectile);
            }
        }
    }, 3000); // Lifespan
}

// Placeholder for hit effects, to be defined (e.g., in ui.js or a new effects.js)
function createHitEffect(position, color) {
    // Create a simple flash effect
    const light = new THREE.PointLight(color, 2, 5);
    light.position.copy(position);
    scene.add(light);

    const startTime = clock.getElapsedTime();

    function fadeOut() {
        const elapsed = clock.getElapsedTime() - startTime;
        if (elapsed < 0.3) { // Duration of flash
            light.intensity = 2 * (1 - elapsed / 0.3);
            requestAnimationFrame(fadeOut);
        } else {
            scene.remove(light);
        }
    }
    fadeOut();
}

// Update enemy projectiles
function updateEnemyProjectiles(delta) {
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const projectile = enemyProjectiles[i];
        if (!projectile) { // Safety check
            enemyProjectiles.splice(i, 1);
            continue;
        }

        // Move projectile
        projectile.position.add(projectile.velocity.clone().multiplyScalar(delta));

        // Check collision with walls
        let hitWall = false;
        for (const wall of walls) {
            const dx = projectile.position.x - wall.position.x;
            const dy = projectile.position.y - wall.position.y; // Assuming wall center Y is 1
            const dz = projectile.position.z - wall.position.z;

            // Simple AABB check for projectile (small sphere) vs wall (2x2x2 box)
            if (Math.abs(dx) < (1 + 0.15) && Math.abs(dy) < (1 + 0.15) && Math.abs(dz) < (1 + 0.15)) {
                if (typeof createHitEffect === 'function') createHitEffect(projectile.position, 0xffff00);
                scene.remove(projectile);
                enemyProjectiles.splice(i, 1);
                hitWall = true;
                break;
            }
        }
        if (hitWall) continue;


        // Check collision with player
        if (player && player.position) {
            const distanceToPlayer = projectile.position.distanceTo(player.position);
            // Player collision radius can be approximated (e.g., 0.5) + projectile radius (0.15)
            if (distanceToPlayer < (0.5 + 0.15)) {
                if (playerShieldActive) {
                    playerHealth -= (projectile.damage || 0) * 0.25; // projectile.damage should be set
                    if (typeof createHitEffect === 'function') createHitEffect(projectile.position, 0x8844ff); // Shield hit
                } else {
                    playerHealth -= (projectile.damage || 0);
                    if (typeof createHitEffect === 'function') createHitEffect(projectile.position, 0xff0000); // Player hit
                }

                if (typeof playSound === 'function') playSound('playerHit');
                scene.remove(projectile);
                enemyProjectiles.splice(i, 1);
                continue;
            }
        }
    }
}