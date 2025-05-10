// Maze generation and wall creation logic

// generateMaze using Depth-First Search (Recursive Backtracker)
function generateMaze() {
    // MAZE_SIZE from config.js now refers to the number of cells in one dimension.
    // The grid for DFS needs to be larger to hold walls between cells.
    // If MAZE_SIZE is N, grid will be (2N+1) x (2N+1).
    // Example: MAZE_SIZE = 5 -> 11x11 grid.
    // Cells are at (2i+1, 2j+1). Walls are at (2i, *) or (*, 2j).
    const actualGridSize = 2 * MAZE_SIZE + 1;
    maze.length = 0; // Clear global maze array

    // Initialize grid with all walls (1 = wall, 0 = path)
    for (let i = 0; i < actualGridSize; i++) {
        maze[i] = [];
        for (let j = 0; j < actualGridSize; j++) {
            maze[i][j] = 1;
        }
    }

    const stack = [];
    // Start DFS from cell (1,1) in the new grid coordinates
    let currentX = 1;
    let currentY = 1;
    maze[currentX][currentY] = 0; // Mark as path
    stack.push([currentX, currentY]);

    while (stack.length > 0) {
        [currentX, currentY] = stack[stack.length - 1]; // Peek

        const neighbors = [];
        // Check North: (currentX, currentY - 2)
        if (currentY - 2 >= 0 && maze[currentX][currentY - 2] === 1) {
            neighbors.push(['N', currentX, currentY - 2]);
        }
        // Check East: (currentX + 2, currentY)
        if (currentX + 2 < actualGridSize && maze[currentX + 2][currentY] === 1) {
            neighbors.push(['E', currentX + 2, currentY]);
        }
        // Check South: (currentX, currentY + 2)
        if (currentY + 2 < actualGridSize && maze[currentX][currentY + 2] === 1) {
            neighbors.push(['S', currentX, currentY + 2]);
        }
        // Check West: (currentX - 2, currentY)
        if (currentX - 2 >= 0 && maze[currentX - 2][currentY] === 1) {
            neighbors.push(['W', currentX - 2, currentY]);
        }

        if (neighbors.length > 0) {
            const [direction, nextX, nextY] = neighbors[Math.floor(Math.random() * neighbors.length)];

            // Carve path to neighbor
            if (direction === 'N') maze[currentX][currentY - 1] = 0; // Wall between
            else if (direction === 'E') maze[currentX + 1][currentY] = 0; // Wall between
            else if (direction === 'S') maze[currentX][currentY + 1] = 0; // Wall between
            else if (direction === 'W') maze[currentX - 1][currentY] = 0; // Wall between
            
            maze[nextX][nextY] = 0; // Mark neighbor as path
            stack.push([nextX, nextY]);
        } else {
            stack.pop(); // Backtrack
        }
    }
    // Player start area maze[1][1] is guaranteed to be a path by this algorithm.
}


function createMazeWalls() {
    const wallGeometry = new THREE.BoxGeometry(2, 2, 2); // Each cell/wall unit is 2x2x2 world units
    const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR }); // WALL_COLOR from config.js
    
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