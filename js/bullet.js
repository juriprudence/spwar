// Bullet related logic

function shoot() {
    if (!player) return; // player is global in main.js

    const bulletGeometry = new THREE.SphereGeometry(...BULLET_GEOMETRY_ARGS); // From config.js
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: BULLET_COLOR }); // From config.js
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Position bullet at player's position
    bullet.position.copy(player.position);

    // Get direction player is facing
    const shootDirection = new THREE.Vector3(); // Renamed from 'direction' to avoid conflict with global 'direction' in main.js
    player.getWorldDirection(shootDirection);

    bullet.velocity = shootDirection.multiplyScalar(BULLET_SPEED); // From config.js
    bullet.alive = true;

    // Add to scene
    scene.add(bullet); // scene is global in main.js
    bullets.push(bullet); // bullets is global in main.js

    // Remove after lifespan
    setTimeout(() => {
        bullet.alive = false;
        if (scene) scene.remove(bullet); // Check if scene still exists
        const index = bullets.indexOf(bullet);
        if (index > -1) {
            bullets.splice(index, 1);
        }
    }, BULLET_LIFESPAN); // From config.js
}

function updateBullets(delta) {
    for (let i = bullets.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
        const bullet = bullets[i];
        if (bullet.alive) {
            bullet.position.add(bullet.velocity.clone().multiplyScalar(delta));

            // Check collision with walls
            for (const wall of walls) { // walls is global in main.js
                const dx = bullet.position.x - wall.position.x;
                const dy = bullet.position.y - wall.position.y; // Assuming wall.position.y is center of wall (1)
                const dz = bullet.position.z - wall.position.z;

                // Wall is 2x2x2, so radius is 1. Bullet radius is small (0.1).
                if (Math.abs(dx) < BULLET_WALL_COLLISION_THRESHOLD &&
                    Math.abs(dy) < BULLET_WALL_COLLISION_THRESHOLD && // Check Y as well
                    Math.abs(dz) < BULLET_WALL_COLLISION_THRESHOLD) {
                    bullet.alive = false;
                    scene.remove(bullet); // scene is global
                    bullets.splice(i, 1);
                    break; // Bullet hits one wall, no need to check others
                }
            }
            if (!bullet.alive) continue; // Skip to next bullet if already removed

            // Check collision with enemies
            for (let j = enemies.length - 1; j >= 0; j--) { // enemies is global
                const enemy = enemies[j];
                
                // Sphere-sphere collision: check distance between centers
                const distanceSquared = bullet.position.distanceToSquared(enemy.position);
                const radiiSumSquared = (BULLET_ENEMY_COLLISION_RADIUS_SUM) * (BULLET_ENEMY_COLLISION_RADIUS_SUM); // From config.js

                if (distanceSquared < radiiSumSquared) {
                    // Damage enemy
                    enemy.health -= BULLET_DAMAGE; // From config.js

                    // Update enemy health bar
                    if (enemy.healthBar) {
                        enemy.healthBar.scale.x = Math.max(0, enemy.health / ENEMY_HEALTH_INITIAL); // ENEMY_HEALTH_INITIAL from config
                    }

                    // Check if enemy is dead
                    if (enemy.health <= 0) {
                        scene.remove(enemy);
                        enemies.splice(j, 1);
                    }

                    // Remove bullet
                    bullet.alive = false;
                    scene.remove(bullet);
                    bullets.splice(i, 1);
                    break; // Bullet hits one enemy
                }
            }
            if (!bullet.alive) continue; // Skip if bullet hit an enemy

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
                            
                            console.log(`Bullet hit remote player ${playerID}`);
                            
                            // Raise event to notify other clients (and self for consistency if needed) about the hit
                            if (photon && photon.isJoinedToRoom()) {
                                photon.raiseEvent(4, { victimActorNr: parseInt(playerID) }); // Event code 4 for player hit
                                console.log(`Raised event 4 (player_hit) for victimActorNr: ${playerID}`);
                            }

                            // Remove bullet
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

// The 'click' event listener for shooting might be added in main.js or ui.js
// document.addEventListener('click', shoot);