// Bullet related logic

function shoot() {
    if (!player) return; // player is global in main.js

    // Check weapon cooldown
    const currentTime = Date.now();
    const currentWeapon = WEAPON_TYPES[currentWeaponLevel];
    const cooldownTime = 1000 * currentWeapon.fireRate; // Convert to milliseconds
    
    if (currentTime - lastShootTime < cooldownTime) {
        return; // Still on cooldown
    }
    
    lastShootTime = currentTime;
    
    // Get direction player is facing
    const shootDirection = new THREE.Vector3();
    player.getWorldDirection(shootDirection);
    
    // Play sound based on weapon type
    if (typeof playSound === 'function') {
        playSound('shoot'); // Use different sounds later if available
    }
    
    switch(currentWeapon.bulletType) {
        case "spread":
            createSpreadShot(currentWeapon, shootDirection);
            break;
        case "laser":
            createLaserShot(currentWeapon, shootDirection);
            break;
        case "rocket":
            createRocketShot(currentWeapon, shootDirection);
            break;
        case "single":
        default:
            createBasicShot(currentWeapon, shootDirection);
            break;
    }
}

function createBasicShot(weapon, direction) {
    const bulletGeometry = new THREE.SphereGeometry(...BULLET_GEOMETRY_ARGS);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: weapon.projectileColor });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Position bullet at player's position
    bullet.position.copy(player.position);

    // Apply velocity based on weapon properties
    bullet.velocity = direction.clone().multiplyScalar(weapon.projectileSpeed);
    bullet.alive = true;
    bullet.damage = weapon.damage;
    bullet.piercing = weapon.piercing || false;
    
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

function createSpreadShot(weapon, direction) {
    const bulletCount = weapon.bulletCount || 3;
    const spreadAngle = weapon.spreadAngle || 0.2;
    
    // Create a quaternion for rotation
    const rotationAxis = new THREE.Vector3(0, 1, 0); // Y-axis for horizontal spread
    
    // Calculate angles for an even spread
    const angleStep = spreadAngle * 2 / (bulletCount - 1);
    const startAngle = -spreadAngle;
    
    for (let i = 0; i < bulletCount; i++) {
        // Create bullet
        const bulletGeometry = new THREE.SphereGeometry(...BULLET_GEOMETRY_ARGS);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: weapon.projectileColor });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Position bullet at player's position
        bullet.position.copy(player.position);
        
        // Calculate direction with spread
        const bulletDirection = direction.clone();
        const angle = startAngle + (angleStep * i);
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
        bulletDirection.applyQuaternion(rotationQuaternion);
        
        // Apply velocity
        bullet.velocity = bulletDirection.multiplyScalar(weapon.projectileSpeed);
        bullet.alive = true;
        bullet.damage = weapon.damage;
        
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
}

function createLaserShot(weapon, direction) {
    // Create a cylinder for the laser beam
    const laserLength = weapon.bulletLength || 1.2;
    const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05, laserLength, 8);
    const laserMaterial = new THREE.MeshBasicMaterial({ 
        color: weapon.projectileColor,
        emissive: weapon.projectileColor,
        emissiveIntensity: 1
    });
    
    // Rotate the cylinder to align with the direction
    laserGeometry.rotateX(Math.PI / 2);
    
    const bullet = new THREE.Mesh(laserGeometry, laserMaterial);
    
    // Position bullet at player's position, slightly forward
    bullet.position.copy(player.position);
    bullet.position.add(direction.clone().multiplyScalar(laserLength/2));
    
    // Apply velocity based on weapon properties
    bullet.velocity = direction.clone().multiplyScalar(weapon.projectileSpeed);
    bullet.alive = true;
    bullet.damage = weapon.damage;
    bullet.piercing = true; // Lasers always pierce

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

function createRocketShot(weapon, direction) {
    // Create a cylinder for the rocket
    const rocketGeometry = new THREE.CylinderGeometry(0.08, 0.15, 0.5, 8);
    // Rotate to point in direction of travel
    rocketGeometry.rotateX(Math.PI / 2);
    
    const rocketMaterial = new THREE.MeshBasicMaterial({ color: weapon.projectileColor });
    const bullet = new THREE.Mesh(rocketGeometry, rocketMaterial);
    
    // Position bullet at player's position
    bullet.position.copy(player.position);
    
    // Apply velocity based on weapon properties
    bullet.velocity = direction.clone().multiplyScalar(weapon.projectileSpeed);
    bullet.alive = true;
    bullet.damage = weapon.damage;
    bullet.isRocket = true;
    bullet.explosionRadius = weapon.explosionRadius || 3;
    
    // Set up the rocket's orientation to match its direction
    bullet.lookAt(bullet.position.clone().add(direction));

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

function updateBullets(delta) {
    for (let i = bullets.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
        const bullet = bullets[i];
        if (bullet.alive) {
            bullet.position.add(bullet.velocity.clone().multiplyScalar(delta));
            
            // If it's a rocket, keep its orientation aligned with its direction
            if (bullet.isRocket) {
                bullet.lookAt(bullet.position.clone().add(bullet.velocity));
            }

            // Check collision with walls
            for (const wall of walls) { // walls is global in main.js
                const dx = bullet.position.x - wall.position.x;
                const dy = bullet.position.y - wall.position.y; // Assuming wall.position.y is center of wall (1)
                const dz = bullet.position.z - wall.position.z;

                // Wall is 2x2x2, so radius is 1. Bullet radius is small (0.1).
                if (Math.abs(dx) < BULLET_WALL_COLLISION_THRESHOLD &&
                    Math.abs(dy) < BULLET_WALL_COLLISION_THRESHOLD && // Check Y as well
                    Math.abs(dz) < BULLET_WALL_COLLISION_THRESHOLD) {
                    
                    // Handle rocket explosion on wall
                    if (bullet.isRocket) {
                        createExplosion(bullet.position, bullet.explosionRadius, bullet.damage);
                    }
                    
                    bullet.alive = false;
                    scene.remove(bullet); // scene is global
                    bullets.splice(i, 1);
                    break; // Bullet hits one wall, no need to check others
                }
            }
            if (!bullet.alive) continue; // Skip to next bullet if already removed

            // Check collision with enemies
            let hitEnemy = false;
            for (let j = enemies.length - 1; j >= 0; j--) { // enemies is global
                const enemy = enemies[j];
                
                // Sphere-sphere collision: check distance between centers
                const distanceSquared = bullet.position.distanceToSquared(enemy.position);
                const radiiSumSquared = (BULLET_ENEMY_COLLISION_RADIUS_SUM) * (BULLET_ENEMY_COLLISION_RADIUS_SUM); // From config.js

                if (distanceSquared < radiiSumSquared) {
                    hitEnemy = true;
                    
                    // Handle rocket explosion
                    if (bullet.isRocket) {
                        createExplosion(bullet.position, bullet.explosionRadius, bullet.damage);
                        bullet.alive = false;
                        scene.remove(bullet);
                        bullets.splice(i, 1);
                        break;
                    }
                    
                    // Damage enemy with bullet's damage value
                    enemy.health -= bullet.damage;

                    // Update enemy health bar
                    if (enemy.healthBar) {
                        enemy.healthBar.scale.x = Math.max(0, enemy.health / ENEMY_HEALTH_INITIAL); // ENEMY_HEALTH_INITIAL from config
                    }

                    // Check if enemy is dead
                    if (enemy.health <= 0) {
                        scene.remove(enemy);
                        enemies.splice(j, 1);
                    }

                    // Remove bullet if not piercing
                    if (!bullet.piercing) {
                    bullet.alive = false;
                    scene.remove(bullet);
                    bullets.splice(i, 1);
                    break; // Bullet hits one enemy
                }
            }
            }
            if (!bullet.alive || (hitEnemy && !bullet.piercing)) continue; // Skip if bullet hit an enemy and doesn't pierce

            // Check collision with other players
            // otherPlayers is a global from multiplayer.js: playerID -> { model, lastUpdate }
            for (const playerID in otherPlayers) {
                if (otherPlayers.hasOwnProperty(playerID)) {
                    const remotePlayer = otherPlayers[playerID];
                    if (remotePlayer && remotePlayer.model) {
                        // Simple bounding box check for now, similar to walls but using player model dimensions
                        // Player model is approx 0.6 wide, 1.8 high, 0.6 deep.
                        // Let's use a slightly larger threshold for player collision.
                        const playerHitThreshold = 0.5; // Half of player width/depth + bullet radius
                        
                        const dx = bullet.position.x - remotePlayer.model.position.x;
                        const dy = bullet.position.y - (remotePlayer.model.position.y + 0.9); // Center of player model (0.9 is half height)
                        const dz = bullet.position.z - remotePlayer.model.position.z;

                        if (Math.abs(dx) < playerHitThreshold &&
                            Math.abs(dy) < (playerHitThreshold + 0.4) && // Taller threshold for Y
                            Math.abs(dz) < playerHitThreshold) {
                            
                            if (bullet.isRocket) {
                                createExplosion(bullet.position, bullet.explosionRadius, bullet.damage);
                            }
                            
                            console.log(`Bullet hit remote player ${playerID}`);
                            
                            // Raise event to notify other clients (and self for consistency if needed) about the hit
                            if (photon && photon.isJoinedToRoom()) {
                                photon.raiseEvent(4, { victimActorNr: parseInt(playerID) }); // Event code 4 for player hit
                                console.log(`Raised event 4 (player_hit) for victimActorNr: ${playerID}`);
                            }

                            // Remove bullet if not piercing
                            if (!bullet.piercing) {
                            bullet.alive = false;
                            if(scene) scene.remove(bullet);
                            bullets.splice(i, 1);
                            break; // Bullet hits one player
                        }
                    }
                }
            }
        }
    }
    }
}

// Create an explosion effect at the given position with given radius
function createExplosion(position, radius, damage) {
    // Visual effect
    const explosionGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const explosionMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff6600, 
        transparent: true,
        opacity: 0.8
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(position);
    scene.add(explosion);
    
    // Animate explosion size
    const expansionSpeed = 20;
    let size = 0.1;
    const maxSize = radius;
    const expandInterval = setInterval(() => {
        size += expansionSpeed * 0.033; // Approximate 30fps
        if (size >= maxSize) {
            clearInterval(expandInterval);
            scene.remove(explosion);
            return;
        }
        explosion.scale.set(size, size, size);
        explosion.material.opacity = 0.8 * (1 - size/maxSize);
    }, 33); // ~30fps
    
    // Check for enemies in explosion radius
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const distanceSquared = position.distanceToSquared(enemy.position);
        
        if (distanceSquared < radius * radius) {
            // Calculate damage falloff based on distance (full damage at center, less at edges)
            const distance = Math.sqrt(distanceSquared);
            const damageMultiplier = 1 - (distance / radius);
            const actualDamage = damage * damageMultiplier;
            
            // Apply damage
            enemy.health -= actualDamage;
            
            // Update health bar
            if (enemy.healthBar) {
                enemy.healthBar.scale.x = Math.max(0, enemy.health / ENEMY_HEALTH_INITIAL);
            }
            
            // Check if enemy is dead
            if (enemy.health <= 0) {
                scene.remove(enemy);
                enemies.splice(i, 1);
            }
        }
    }
    
    // Check for player damage - would need to implement for multiplayer
}

// The 'click' event listener for shooting might be added in main.js or ui.js
// document.addEventListener('click', shoot);