// Maze generation and wall creation logic

// generateMaze using Depth-First Search (Recursive Backtracker)
function generateMaze() {
    maze.length = 0; // Clear global maze array (maze is global from main.js)

    // Use MAZE_SIZE from config to determine dimensions for a static, open maze with borders.
    // The actual grid size will be (2 * MAZE_SIZE + 1)
    const gridSize = (typeof MAZE_SIZE !== 'undefined' ? MAZE_SIZE : 5); // Default to 5 if MAZE_SIZE undefined for cell count
    const actualGridSize = 2 * gridSize + 1;

    // Initialize with all paths (0) for a large open space, then add border walls.
    for (let i = 0; i < actualGridSize; i++) {
        maze[i] = [];
        for (let j = 0; j < actualGridSize; j++) {
            if (i === 0 || i === actualGridSize - 1 || j === 0 || j === actualGridSize - 1) {
                maze[i][j] = 1; // Border walls
            } else {
                // Randomly place walls, adjust probability (e.g., 0.2 for 20% walls) as needed.
                // Higher probability means more walls.
                maze[i][j] = (Math.random() < 0.2) ? 1 : 0;
            }
        }
    }
    
    // Ensure specific spawn areas are clear after random wall generation
    const centerIdx = Math.floor(actualGridSize / 2); // Same as (actualGridSize - 1) / 2 for odd actualGridSize

    // Clear a 3x3 area around the center for Player 1 (world 0,0)
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const r = centerIdx + i;
            const c = centerIdx + j;
            // Check bounds (though center +/- 1 should be within non-border for MAZE_SIZE >= 1)
            if (r > 0 && r < actualGridSize - 1 && c > 0 && c < actualGridSize - 1) {
                if (maze[r] && typeof maze[r][c] !== 'undefined') {
                    maze[r][c] = 0; // 0 for path
                }
            }
        }
    }

    // Clear spots for other players (e.g., world X=+4, X=-4, Z=0)
    // World X = 4 maps to grid i = centerIdx + 2
    // World X = -4 maps to grid i = centerIdx - 2
    const spawnOffset = 2; // Grid unit offset from center for other spawns

    // Spawn 2 (e.g., world X=4, Z=0)
    if (centerIdx + spawnOffset > 0 && centerIdx + spawnOffset < actualGridSize - 1) {
        if (maze[centerIdx + spawnOffset] && typeof maze[centerIdx + spawnOffset][centerIdx] !== 'undefined') {
            maze[centerIdx + spawnOffset][centerIdx] = 0;
             // Optionally clear a small area around it too
            if (maze[centerIdx + spawnOffset][centerIdx-1]) maze[centerIdx + spawnOffset][centerIdx-1] = 0;
            if (maze[centerIdx + spawnOffset][centerIdx+1]) maze[centerIdx + spawnOffset][centerIdx+1] = 0;

        }
    }
    // Spawn 3 (e.g., world X=-4, Z=0)
    if (centerIdx - spawnOffset > 0 && centerIdx - spawnOffset < actualGridSize - 1) {
         if (maze[centerIdx - spawnOffset] && typeof maze[centerIdx - spawnOffset][centerIdx] !== 'undefined') {
            maze[centerIdx - spawnOffset][centerIdx] = 0;
            if (maze[centerIdx - spawnOffset][centerIdx-1]) maze[centerIdx - spawnOffset][centerIdx-1] = 0;
            if (maze[centerIdx - spawnOffset][centerIdx+1]) maze[centerIdx - spawnOffset][centerIdx+1] = 0;
        }
    }
    // Could add more for Z offsets too, e.g., maze[centerIdx][centerIdx + spawnOffset] = 0;

    console.log(`generateMaze: Maze generation complete. Cleared spawn areas around grid center (${centerIdx},${centerIdx}). MAZE_SIZE ${gridSize} (actualGridSize ${actualGridSize}).`);
}


function createMazeWalls() {
    const wallGeometry = new THREE.BoxGeometry(2, 2, 2); // Each cell/wall unit is 2x2x2 world units
    
    // Load the wall texture
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('texture/wall.jpeg',
        function (texture) {
            // Optional: configure texture properties here if needed
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            // texture.repeat.set(1, 1); // Adjust UV repeat if necessary for the 2x2x2 box
            console.log("Wall texture loaded successfully.");
        },
        undefined, // onProgress callback (optional)
        function (err) {
            console.error('An error happened while loading the wall texture:', err);
        }
    );

    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        color: 0xffffff // Set base color to white to show texture purely, or use WALL_COLOR to tint
        // roughness: 0.8, // Adjust material properties as desired
        // metalness: 0.2
    });
    
    const actualGridSize = maze.length; // Should be 2 * MAZE_SIZE + 1

    for (let i = 0; i < actualGridSize; i++) {
        for (let j = 0; j < actualGridSize; j++) {
            if (maze[i][j] === 1) { // If it's a wall in our grid
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                // Position calculation:
                // The grid (0,0) is top-left. World origin (0,0,0) is center of the floor.
                // Each grid unit is 2 world units.
                // World X = (grid_i * 2) - (actualGridSize * 2 / 2) + (2 / 2)
                // World X = i * 2 - actualGridSize + 1
                wall.position.set(
                    i * 2 - actualGridSize + 1, // X
                    1,                             // Y (center of wall height)
                    j * 2 - actualGridSize + 1  // Z
                );
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall); // scene is global in main.js
                walls.push(wall); // walls is global in main.js
            }
        }
    }
}
function clearMazeWalls() {
    if (scene && walls && walls.length > 0) { // scene and walls are global
        console.log("Clearing existing maze walls. Count:", walls.length);
        walls.forEach(wall => {
            scene.remove(wall);
            // Optional: Dispose geometry and material if memory becomes an issue
            // if (wall.geometry) wall.geometry.dispose();
            // if (wall.material) wall.material.dispose();
        });
        walls.length = 0; // Clear the array
    } else {
        console.log("clearMazeWalls: No walls to clear or scene/walls array not available.");
    }
}
