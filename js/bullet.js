// Bullet related logic

// Particle system for bullets
function createBulletTrailParticles(bullet, color) {
    // Create a simple particle system for the bullet trail
    const particleCount = 15;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Initialize particles in a small area behind the bullet
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = 0;
        particlePositions[i * 3 + 1] = 0;
        particlePositions[i * 3 + 2] = 0;
        particleSizes[i] = Math.random() * 0.05 + 0.02; // Random sizes
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Create a texture for particles if desired
    // const particleTexture = new THREE.TextureLoader().load('texture/particle.png');
    
    const particleMaterial = new THREE.PointsMaterial({
        color: color || 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        // map: particleTexture, // Uncomment if using a texture
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    bullet.add(particles);
    
    // Store particle data for animation
    particles.userData = {
        positions: particlePositions,
        initialPositions: particlePositions.slice(),
        lifetimes: new Float32Array(particleCount),
        velocities: []
    };
    
    // Initialize lifetimes and velocities for each particle
    for (let i = 0; i < particleCount; i++) {
        particles.userData.lifetimes[i] = Math.random() * 0.8 + 0.2; // Random lifetime between 0.2 and 1.0
        
        // Create a slightly randomized velocity opposite to bullet direction
        const velocity = bullet.velocity ? bullet.velocity.clone().negate().multiplyScalar(Math.random() * 0.1) : new THREE.Vector3(0, 0, 0);
        // Add some random spread
        velocity.x += (Math.random() - 0.5) * 0.1;
        velocity.y += (Math.random() - 0.5) * 0.1;
        velocity.z += (Math.random() - 0.5) * 0.1;
        
        particles.userData.velocities.push(velocity);
    }
    
    return particles;
}

// Function to create muzzle flash particles at the gun position
function createMuzzleFlashParticles(position, direction, color) {
    const particleCount = 10;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Initialize particles in a small cone in the direction of shooting
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = position.x;
        particlePositions[i * 3 + 1] = position.y;
        particlePositions[i * 3 + 2] = position.z;
        particleSizes[i] = Math.random() * 0.15 + 0.05; // Random sizes
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: color || 0xffaa33,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    
    // Store particle data for animation
    particles.userData = {
        positions: particlePositions,
        lifetimes: new Float32Array(particleCount),
        maxLifetime: 0.2, // Shorter lifetime for muzzle flash
        velocities: []
    };
    
    // Initialize lifetimes and velocities for each particle
    for (let i = 0; i < particleCount; i++) {
        particles.userData.lifetimes[i] = Math.random() * 0.2; // Random lifetime
        
        // Create a velocity in the shooting direction with random spread
        const velocity = direction.clone().multiplyScalar(Math.random() * 2);
        // Add some random spread
        velocity.x += (Math.random() - 0.5) * 0.5;
        velocity.y += (Math.random() - 0.5) * 0.5;
        velocity.z += (Math.random() - 0.5) * 0.5;
        
        particles.userData.velocities.push(velocity);
    }
    
    // Remove after lifetime
    setTimeout(() => {
        scene.remove(particles);
    }, 200); // 200ms
    
    return particles;
}

// Update function for particles - call this in the animation loop
function updateParticles(delta) {
    // Update bullet trail particles
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        if (!bullet.alive) continue;
        
        bullet.children.forEach(child => {
            if (child instanceof THREE.Points && child.userData.positions) {
                const positions = child.userData.positions;
                const lifetimes = child.userData.lifetimes;
                const velocities = child.userData.velocities;
                
                for (let j = 0; j < lifetimes.length; j++) {
                    // Reduce lifetime
                    lifetimes[j] -= delta;
                    
                    // If particle is dead, reset it to the bullet's position
                    if (lifetimes[j] <= 0) {
                        positions[j * 3] = 0;
                        positions[j * 3 + 1] = 0;
                        positions[j * 3 + 2] = 0;
                        lifetimes[j] = Math.random() * 0.8 + 0.2; // Reset lifetime
                    } else {
                        // Calculate new positions with delta time scaling
                        const dx = velocities[j].x * delta;
                        const dy = velocities[j].y * delta;
                        const dz = velocities[j].z * delta;

                        const newX = positions[j * 3] + dx;
                        const newY = positions[j * 3 + 1] + dy;
                        const newZ = positions[j * 3 + 2] + dz;

                        // Only update if values are valid
                        if (!isNaN(newX) && !isNaN(newY) && !isNaN(newZ)) {
                            positions[j * 3] = newX;
                            positions[j * 3 + 1] = newY;
                            positions[j * 3 + 2] = newZ;
                        } else {
                            // Reset particle if it becomes invalid
                            positions[j * 3] = 0;
                            positions[j * 3 + 1] = 0;
                            positions[j * 3 + 2] = 0;
                            lifetimes[j] = 0; // This will trigger a reset on next frame
                        }
                    }
                }
                
                // Update the geometry
                child.geometry.attributes.position.needsUpdate = true;
            }
        });
    }
    
    // Update any standalone particle systems (like muzzle flashes)
    scene.children.forEach(child => {
        if (child instanceof THREE.Points && child.userData.maxLifetime) {
            const positions = child.userData.positions;
            const lifetimes = child.userData.lifetimes;
            const velocities = child.userData.velocities;
            let allDead = true;
            
            for (let j = 0; j < lifetimes.length; j++) {
                // Reduce lifetime
                lifetimes[j] -= delta;
                
                if (lifetimes[j] > 0) {
                    allDead = false;
                    
                    // Calculate new positions with delta time scaling
                    const dx = velocities[j].x * delta;
                    const dy = velocities[j].y * delta;
                    const dz = velocities[j].z * delta;

                    const newX = positions[j * 3] + dx;
                    const newY = positions[j * 3 + 1] + dy;
                    const newZ = positions[j * 3 + 2] + dz;

                    // Only update if values are valid
                    if (!isNaN(newX) && !isNaN(newY) && !isNaN(newZ)) {
                        positions[j * 3] = newX;
                        positions[j * 3 + 1] = newY;
                        positions[j * 3 + 2] = newZ;
                    } else {
                        // If position becomes invalid, mark particle as dead
                        lifetimes[j] = 0;
                    }
                    
                    // Fade out based on lifetime
                    const fadeRatio = lifetimes[j] / child.userData.maxLifetime;
                    child.material.opacity = fadeRatio * 0.8;
                }
            }
            
            // Update the geometry
            child.geometry.attributes.position.needsUpdate = true;
            
            // If all particles are dead, remove the system
            if (allDead) {
                scene.remove(child);
            }
        }
    });
}

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
    
    // Create muzzle flash at the gun position
    const muzzlePosition = player.position.clone();
    muzzlePosition.y += 0.5; // Adjust to gun height
    createMuzzleFlashParticles(muzzlePosition, shootDirection, currentWeapon.projectileColor);
    
    // Try to play sound and initialize audio if needed
    if (typeof playSound === 'function') {
        playSound('shoot_local'); // Use local identifier for shooting sound
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
    
    // Add particle trail to the bullet
    createBulletTrailParticles(bullet, weapon.projectileColor);
    
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
        
        // Add particle trail to the bullet
        createBulletTrailParticles(bullet, weapon.projectileColor);
        
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

    // Add a glowing particle trail for the laser - smaller and more focused
    const trailParticles = createBulletTrailParticles(bullet, weapon.projectileColor);
    // Adjust trail particles for laser
    trailParticles.material.size = 0.08;
    trailParticles.material.opacity = 0.9;

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

    // Add rocket trail particles - make it look like exhaust
    const trailParticles = createBulletTrailParticles(bullet, 0xff5500); // Orange-red for rocket exhaust
    // Customize the rocket trail
    trailParticles.material.size = 0.15;
    trailParticles.material.opacity = 0.8;
    // Override the velocities to be more like exhaust
    for (let i = 0; i < trailParticles.userData.velocities.length; i++) {
        // Stronger backward velocity for rocket exhaust effect
        trailParticles.userData.velocities[i] = bullet.velocity.clone().negate().multiplyScalar(Math.random() * 0.3 + 0.1);
        // Less spread for a more focused exhaust
        trailParticles.userData.velocities[i].x += (Math.random() - 0.5) * 0.05;
        trailParticles.userData.velocities[i].y += (Math.random() - 0.5) * 0.05;
        trailParticles.userData.velocities[i].z += (Math.random() - 0.5) * 0.05;
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
                    
                    // Create impact particles at collision point
                    if (typeof createBulletImpactParticles === 'function') {
                        // Get bullet color from the material if available
                        const bulletColor = bullet.material && bullet.material.color ? 
                            bullet.material.color.getHex() : 0xff9933;
                        
                        createBulletImpactParticles(bullet.position.clone(), bulletColor);
                    }
                    
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
                    
                    // Create impact particles at collision point
                    if (typeof createBulletImpactParticles === 'function') {
                        // Get bullet color from the material if available
                        const bulletColor = bullet.material && bullet.material.color ? 
                            bullet.material.color.getHex() : 0xff9933;
                        
                        createBulletImpactParticles(bullet.position.clone(), bulletColor);
                    }
                    
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
                            
                            // Create impact particles at collision point
                            if (typeof createBulletImpactParticles === 'function') {
                                // Get bullet color from the material if available
                                const bulletColor = bullet.material && bullet.material.color ? 
                                    bullet.material.color.getHex() : 0xff9933;
                                
                                createBulletImpactParticles(bullet.position.clone(), bulletColor);
                            }
                            
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
    
    // Create explosion particles
    const particleCount = 40;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Initialize particles at explosion center
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = position.x;
        particlePositions[i * 3 + 1] = position.y;
        particlePositions[i * 3 + 2] = position.z;
        particleSizes[i] = Math.random() * 0.2 + 0.05; // Random sizes
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xff3300,
        size: 0.2,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    
    // Store particle data for animation
    particles.userData = {
        positions: particlePositions,
        lifetimes: new Float32Array(particleCount),
        maxLifetime: 0.8, // Explosion particle lifetime
        velocities: []
    };
    
    // Initialize lifetimes and velocities for each particle
    for (let i = 0; i < particleCount; i++) {
        particles.userData.lifetimes[i] = Math.random() * 0.8; // Random lifetime
        
        // Create a velocity in random direction
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        
        particles.userData.velocities.push(velocity);
    }
    
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
    
    // Remove particles after lifetime
    setTimeout(() => {
        scene.remove(particles);
    }, 800); // 800ms
    
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

// Function to create dust particles when player moves
function createPlayerMovementDust(playerPosition, color) {
    const particleCount = 8;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Initialize particles around the player's feet
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = playerPosition.x + (Math.random() - 0.5) * 0.3;
        particlePositions[i * 3 + 1] = 0.1; // Just above the ground
        particlePositions[i * 3 + 2] = playerPosition.z + (Math.random() - 0.5) * 0.3;
        particleSizes[i] = Math.random() * 0.08 + 0.02; // Random sizes
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: color || 0xd2b48c, // Tan/dust color
        size: 0.1,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    
    // Store particle data for animation
    particles.userData = {
        positions: particlePositions,
        lifetimes: new Float32Array(particleCount),
        maxLifetime: 0.5, // Dust lifetime
        velocities: []
    };
    
    // Initialize lifetimes and velocities for each particle
    for (let i = 0; i < particleCount; i++) {
        particles.userData.lifetimes[i] = Math.random() * 0.5; // Random lifetime up to 0.5s
        
        // Create a random velocity for the dust particles
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3, // Random X
            Math.random() * 0.5,         // Up
            (Math.random() - 0.5) * 0.3  // Random Z
        );
        
        particles.userData.velocities.push(velocity);
    }
    
    // Remove after lifetime
    setTimeout(() => {
        scene.remove(particles);
    }, 500); // 500ms
    
    return particles;
}

// Function to create dust particles for enemy movement (smaller and white)
function createEnemyMovementDust(enemyPosition) {
    const particleCount = 5; // Fewer particles
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Initialize particles around the enemy's feet
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = enemyPosition.x + (Math.random() - 0.5) * 0.2; // Smaller spread
        particlePositions[i * 3 + 1] = 0.05; // Lower to the ground
        particlePositions[i * 3 + 2] = enemyPosition.z + (Math.random() - 0.5) * 0.2; // Smaller spread
        particleSizes[i] = Math.random() * 0.05 + 0.01; // Smaller sizes
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xffffff, // White color
        size: 0.05, // Smaller size
        transparent: true,
        opacity: 0.3, // More transparent
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    
    // Store particle data for animation
    particles.userData = {
        positions: particlePositions,
        lifetimes: new Float32Array(particleCount),
        maxLifetime: 0.3, // Shorter lifetime
        velocities: []
    };
    
    // Initialize lifetimes and velocities for each particle
    for (let i = 0; i < particleCount; i++) {
        particles.userData.lifetimes[i] = Math.random() * 0.3; // Random shorter lifetime
        
        // Create a random velocity for the dust particles
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2, // Smaller X spread
            Math.random() * 0.3,         // Less height
            (Math.random() - 0.5) * 0.2  // Smaller Z spread
        );
        
        particles.userData.velocities.push(velocity);
    }
    
    // Remove after lifetime
    setTimeout(() => {
        scene.remove(particles);
    }, 300); // 300ms - shorter duration
    
    return particles;
}

// Create impact particles when bullet hits something
function createBulletImpactParticles(position, color) {
    const particleCount = 12;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Initialize particles at impact point
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = position.x;
        particlePositions[i * 3 + 1] = position.y;
        particlePositions[i * 3 + 2] = position.z;
        particleSizes[i] = Math.random() * 0.07 + 0.03; // Random sizes
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: color || 0xff9933, // Orange-yellow by default
        size: 0.1,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    
    // Store particle data for animation
    particles.userData = {
        positions: particlePositions,
        lifetimes: new Float32Array(particleCount),
        maxLifetime: 0.4, // Short lifetime
        velocities: []
    };
    
    // Initialize lifetimes and velocities for each particle
    for (let i = 0; i < particleCount; i++) {
        particles.userData.lifetimes[i] = Math.random() * 0.4; // Random lifetime up to 0.4s
        
        // Create a velocity in random direction (spherical spread from impact point)
        const theta = Math.random() * Math.PI * 2; // Random angle around y-axis
        const phi = Math.random() * Math.PI; // Random angle from y-axis
        const speed = Math.random() * 2 + 1; // Random speed
        
        const velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed
        );
        
        particles.userData.velocities.push(velocity);
    }
    
    // Remove after lifetime
    setTimeout(() => {
        scene.remove(particles);
    }, 400); // 400ms
    
    return particles;
}

// Export the update function for main.js animation loop
if (typeof window !== 'undefined') {
    window.updateBullets = updateBullets;
    window.updateParticles = updateParticles;
    window.createPlayerMovementDust = createPlayerMovementDust;
    window.createEnemyMovementDust = createEnemyMovementDust;
    window.createBulletImpactParticles = createBulletImpactParticles;
}

// The 'click' event listener for shooting might be added in main.js or ui.js
// document.addEventListener('click', shoot);