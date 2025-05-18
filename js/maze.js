// Maze generation and wall creation logic

// generateMaze using procedural generation for large mazes
function generateMaze() {
    maze.length = 0; // Clear global maze array (maze is global from main.js)

    // Use MAZE_SIZE from config to determine dimensions
    const gridSize = (typeof MAZE_SIZE !== 'undefined' ? MAZE_SIZE : 49.5);
    const actualGridSize = Math.floor(2 * gridSize + 1); // Should be 100

    // Initialize maze array with walls
    for (let i = 0; i < actualGridSize; i++) {
        maze[i] = [];
        for (let j = 0; j < actualGridSize; j++) {
            // Set borders and initial walls
            if (i === 0 || i === actualGridSize - 1 || j === 0 || j === actualGridSize - 1) {
                maze[i][j] = 1; // Border walls
            } else if (i % 2 === 0 && j % 2 === 0) {
                maze[i][j] = 1; // Interior wall posts
            } else {
                maze[i][j] = 0; // Open space
            }
        }
    }

    // Create a grid pattern with rooms and corridors
    for (let i = 5; i < actualGridSize - 5; i += 10) {
        for (let j = 5; j < actualGridSize - 5; j += 10) {
            // Create rooms
            createRoom(i, j, Math.min(8, actualGridSize - i - 2), Math.min(8, actualGridSize - j - 2));
            
            // Create corridors between rooms
            if (j + 10 < actualGridSize - 5) {
                createHorizontalCorridor(i + 4, j + 8, 4); // Horizontal corridor
            }
            if (i + 10 < actualGridSize - 5) {
                createVerticalCorridor(i + 8, j + 4, 4); // Vertical corridor
            }
        }
    }

    // Ensure spawn areas are clear
    const centerIdx = Math.floor(actualGridSize / 2);
    clearSpawnArea(centerIdx, centerIdx, 3); // Clear center spawn area

    // Add some random paths through the maze
    addRandomPaths(20); // Add 20 random paths

    console.log(`generateMaze: Large maze generated. Size: ${actualGridSize}x${actualGridSize}`);
    
    // Create the walls
    createMazeWalls();
}

// Helper function to create a room
function createRoom(startI, startJ, width, height) {
    for (let i = startI; i < startI + width; i++) {
        for (let j = startJ; j < startJ + height; j++) {
            if (i > 0 && i < maze.length - 1 && j > 0 && j < maze.length - 1) {
                maze[i][j] = 0;
            }
        }
    }
}

// Helper function to create a horizontal corridor
function createHorizontalCorridor(i, j, width) {
    for (let x = 0; x < width; x++) {
        if (i > 0 && i < maze.length - 1 && (j + x) > 0 && (j + x) < maze.length - 1) {
            maze[i][j + x] = 0;
            maze[i - 1][j + x] = 0;
            maze[i + 1][j + x] = 0;
        }
    }
}

// Helper function to create a vertical corridor
function createVerticalCorridor(i, j, height) {
    for (let y = 0; y < height; y++) {
        if ((i + y) > 0 && (i + y) < maze.length - 1 && j > 0 && j < maze.length - 1) {
            maze[i + y][j] = 0;
            maze[i + y][j - 1] = 0;
            maze[i + y][j + 1] = 0;
        }
    }
}

// Helper function to clear spawn area
function clearSpawnArea(centerI, centerJ, radius) {
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
            const r = centerI + i;
            const c = centerJ + j;
            if (r > 0 && r < maze.length - 1 && c > 0 && c < maze.length - 1) {
                maze[r][c] = 0;
            }
        }
    }
}

// Helper function to add random paths through the maze
function addRandomPaths(count) {
    for (let n = 0; n < count; n++) {
        let i = 2 + Math.floor(Math.random() * (maze.length - 4));
        let j = 2 + Math.floor(Math.random() * (maze.length - 4));
        
        // Create a random path
        for (let steps = 0; steps < 50; steps++) {
            if (i > 1 && i < maze.length - 2 && j > 1 && j < maze.length - 2) {
                maze[i][j] = 0;
                // Randomly move in one direction
                const direction = Math.floor(Math.random() * 4);
                switch(direction) {
                    case 0: i += 1; break;
                    case 1: i -= 1; break;
                    case 2: j += 1; break;
                    case 3: j -= 1; break;
                }
            }
        }
    }
}

function createMazeWalls() {
    // Clear existing walls first
    clearMazeWalls();

    // Load the wall texture
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('texture/wall.jpeg',
        function (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            console.log("Wall texture loaded successfully.");
        },
        undefined,
        function (err) {
            console.error('An error happened while loading the wall texture:', err);
        }
    );

    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        color: 0xffffff
    });
    
    const actualGridSize = maze.length;

    for (let i = 0; i < actualGridSize; i++) {
        for (let j = 0; j < actualGridSize; j++) {
            if (maze[i][j] === 1) { // If it's a wall in our grid
                // Fixed height for all walls to ensure consistency
                const wallHeight = 3;
                
                // Create wall geometry with fixed height
                const wallGeometry = new THREE.BoxGeometry(2, wallHeight, 2);
                
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                
                wall.position.set(
                    i * 2 - actualGridSize + 1,
                    wallHeight / 2,
                    j * 2 - actualGridSize + 1
                );
                
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                walls.push(wall);
            }
        }
    }
}

function clearMazeWalls() {
    if (scene && walls && walls.length > 0) {
        console.log("Clearing existing maze walls. Count:", walls.length);
        walls.forEach(wall => {
            scene.remove(wall);
            if (wall.geometry) wall.geometry.dispose();
            if (wall.material && wall.material.map) wall.material.map.dispose();
            if (wall.material) wall.material.dispose();
        });
        walls.length = 0;
    } else {
        console.log("clearMazeWalls: No walls to clear or scene/walls array not available.");
    }
}
