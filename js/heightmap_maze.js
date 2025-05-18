// Mars battlefield generation and terrain creation based on heightmap

// Save original functions if needed for fallback
const originalGenerateMaze = window.generateMaze;
const originalCreateMazeWalls = window.createMazeWalls;
const originalClearMazeWalls = window.clearMazeWalls;

// Import the seeded random if available for consistent placement
let mazeRandom;
if (typeof SeededRandom !== 'undefined') {
    mazeRandom = new SeededRandom(12345); // Use same seed as maze.js
} else {
    // Create a local version if not available
    class SeededRandom {
        constructor(seed) {
            this.seed = seed;
        }
        
        next() {
            this.seed ^= this.seed << 13;
            this.seed ^= this.seed >> 17;
            this.seed ^= this.seed << 5;
            return (this.seed >>> 0) / 4294967296;
        }
    }
    mazeRandom = new SeededRandom(12345);
}

// Override the original functions with heightmap-based implementations
window.generateMaze = function() {
    console.log("Using heightmap-based Mars terrain generation (heightmap_maze.js)");
    
    // Clear global maze array (maze is global from main.js)
    maze.length = 0; 

    // Use MAZE_SIZE from config to determine dimensions
    const gridSize = (typeof MAZE_SIZE !== 'undefined' ? MAZE_SIZE : 8); 
    const actualGridSize = 2 * gridSize + 1;

    // Initialize maze array with default values
    for (let i = 0; i < actualGridSize; i++) {
        maze[i] = [];
        for (let j = 0; j < actualGridSize; j++) {
            // Default to border mountains on edges, open space within
            if (i === 0 || i === actualGridSize - 1 || j === 0 || j === actualGridSize - 1) {
                maze[i][j] = 1; // Border mountains
            } else {
                maze[i][j] = 0; // Open by default, will be populated based on heightmap
            }
        }
    }
    
    // Ensure spawn areas are clear
    const centerIdx = Math.floor(actualGridSize / 2);

    // Player 1 spawns in the center (world 0,0)
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const r = centerIdx + i;
            const c = centerIdx + j;
            if (r > 0 && r < actualGridSize - 1 && c > 0 && c < actualGridSize - 1) {
                if (maze[r] && typeof maze[r][c] !== 'undefined') {
                    maze[r][c] = 0; // Clear path for spawn
                }
            }
        }
    }

    // Clear spots for other players
    const spawnOffset = 2;

    // Spawn 2 (world X=4, Z=0)
    if (centerIdx + spawnOffset > 0 && centerIdx + spawnOffset < actualGridSize - 1) {
        if (maze[centerIdx + spawnOffset] && typeof maze[centerIdx + spawnOffset][centerIdx] !== 'undefined') {
            maze[centerIdx + spawnOffset][centerIdx] = 0;
            if (maze[centerIdx + spawnOffset][centerIdx-1]) maze[centerIdx + spawnOffset][centerIdx-1] = 0;
            if (maze[centerIdx + spawnOffset][centerIdx+1]) maze[centerIdx + spawnOffset][centerIdx+1] = 0;
        }
    }
    
    // Spawn 3 (world X=-4, Z=0)
    if (centerIdx - spawnOffset > 0 && centerIdx - spawnOffset < actualGridSize - 1) {
         if (maze[centerIdx - spawnOffset] && typeof maze[centerIdx - spawnOffset][centerIdx] !== 'undefined') {
            maze[centerIdx - spawnOffset][centerIdx] = 0;
            if (maze[centerIdx - spawnOffset][centerIdx-1]) maze[centerIdx - spawnOffset][centerIdx-1] = 0;
            if (maze[centerIdx - spawnOffset][centerIdx+1]) maze[centerIdx - spawnOffset][centerIdx+1] = 0;
        }
    }

    // Now we'll load the heightmap and populate the maze based on it
    loadHeightmapAndPopulateMaze(actualGridSize);

    console.log(`Mars battlefield generated based on heightmap. Center: (${centerIdx},${centerIdx}). Size: ${actualGridSize}x${actualGridSize}`);
};

// Load heightmap and populate maze array based on it
function loadHeightmapAndPopulateMaze(actualGridSize) {
    // Create a temporary canvas to process the heightmap image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Store terrain data for later use (height values from the heightmap)
    window.terrainHeightData = [];
    for (let i = 0; i < actualGridSize; i++) {
        window.terrainHeightData[i] = [];
        for (let j = 0; j < actualGridSize; j++) {
            window.terrainHeightData[i][j] = 0; // Default height
        }
    }
    
    img.onload = function() {
        // Set canvas size to match the image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image to the canvas
        ctx.drawImage(img, 0, 0);
        
        // Sample the image pixels to populate the maze
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Map the heightmap to our maze grid
        const pixelsPerCellX = Math.max(1, Math.floor(canvas.width / actualGridSize));
        const pixelsPerCellY = Math.max(1, Math.floor(canvas.height / actualGridSize));
        
        console.log(`Heightmap dimensions: ${canvas.width}x${canvas.height}, sampling every ${pixelsPerCellX}x${pixelsPerCellY} pixels`);
        
        for (let i = 0; i < actualGridSize; i++) {
            for (let j = 0; j < actualGridSize; j++) {
                // Skip the border cells which should remain as mountains
                if (i === 0 || i === actualGridSize - 1 || j === 0 || j === actualGridSize - 1) {
                    continue;
                }
                
                // Calculate the pixel coordinates in the heightmap image
                const pixelX = Math.min(canvas.width - 1, Math.floor(i * canvas.width / actualGridSize));
                const pixelY = Math.min(canvas.height - 1, Math.floor(j * canvas.height / actualGridSize));
                
                // Get the pixel data (RGBA) at this position
                const index = (pixelY * canvas.width + pixelX) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                // Use the average of RGB as the height value (0-255)
                const heightValue = (r + g + b) / 3;
                
                // Store the normalized height value (0.0-1.0) for terrain generation
                window.terrainHeightData[i][j] = heightValue / 255;
                
                // Determine if this is an obstacle based on height threshold
                // Higher values in the heightmap become mountains/obstacles
                // Use seeded random for consistent obstacle placement when heightmap values are close to threshold
                const randomAdjustment = mazeRandom.next() * 20 - 10; // Range -10 to +10
                if (heightValue + randomAdjustment > 180) { // Adjusted threshold
                    maze[i][j] = 1; // Mark as mountain/obstacle
                } else {
                    maze[i][j] = 0; // Mark as open terrain
                }
            }
        }
        
        // Ensure spawn areas are clear - after heightmap processing
        ensureSpawnAreasAreClear(actualGridSize);
        
        // Create the terrain (this will use the heightmap data)
        window.createMazeWalls();
        
        console.log("Heightmap processed and maze grid populated. Terrain created.");

        // Now that terrain is created, set the player's initial position.
        if (typeof setLocalPlayerInitialPosition === 'function') {
            console.log("Calling setLocalPlayerInitialPosition from heightmap_maze.js after terrain creation.");
            setLocalPlayerInitialPosition();
        } else {
            console.error("setLocalPlayerInitialPosition function not found when trying to call from heightmap_maze.js");
        }

    };
    
    // Handle image loading errors
    img.onerror = function() {
        console.error("Error loading heightmap image. Using default terrain generation.");
        // Fall back to original maze generation method
        if (originalCreateMazeWalls) {
            originalCreateMazeWalls();
        } else {
            window.createMazeWalls();
        }
    };
    
    // Load the heightmap image - use a consistent filename
    // Fix typo in filename from "hithmap.png" to "heightmap.png"
    img.src = 'texture/hitmap.png';
}

// Ensure spawn areas are clear after heightmap processing
function ensureSpawnAreasAreClear(actualGridSize) {
    const centerIdx = Math.floor(actualGridSize / 2);
    
    // Player 1 spawn (center)
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const r = centerIdx + i;
            const c = centerIdx + j;
            if (r > 0 && r < actualGridSize - 1 && c > 0 && c < actualGridSize - 1) {
                maze[r][c] = 0;
            }
        }
    }
    
    // Other player spawns
    const spawnOffset = 2;
    
    // Spawn 2
    if (centerIdx + spawnOffset > 0 && centerIdx + spawnOffset < actualGridSize - 1) {
        maze[centerIdx + spawnOffset][centerIdx] = 0;
        if (centerIdx - 1 > 0) maze[centerIdx + spawnOffset][centerIdx - 1] = 0;
        if (centerIdx + 1 < actualGridSize - 1) maze[centerIdx + spawnOffset][centerIdx + 1] = 0;
    }
    
    // Spawn 3
    if (centerIdx - spawnOffset > 0 && centerIdx - spawnOffset < actualGridSize - 1) {
        maze[centerIdx - spawnOffset][centerIdx] = 0;
        if (centerIdx - 1 > 0) maze[centerIdx - spawnOffset][centerIdx - 1] = 0;
        if (centerIdx + 1 < actualGridSize - 1) maze[centerIdx - spawnOffset][centerIdx + 1] = 0;
    }
}

// Override the createMazeWalls function
window.createMazeWalls = function() {
    // Create Mars terrain elements
    createMarsFloor();
    createHeightmapTerrain();
};

// Create reddish Mars floor with realistic texture
function createMarsFloor() {
    const actualGridSize = maze.length;
    const floorSize = actualGridSize * 2; // Each cell is 2x2 world units
    
    // Create a large floor plane for the Mars battlefield
    const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize, actualGridSize-1, actualGridSize-1);
    
    // Create Mars-like reddish material (texture removed)
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xc65d45, // Reddish-orange color for Mars surface
        roughness: 0.9,
        metalness: 0.1
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floor.position.y = 0; // At ground level
    floor.receiveShadow = true;
    
    // If we have terrain height data, apply it to the floor geometry vertices
    if (window.terrainHeightData && window.terrainHeightData.length > 0) {
        const vertices = floor.geometry.attributes.position.array;
        const actualGridSize = window.terrainHeightData.length;
        
        // Apply height data to vertices
        for (let i = 0; i < actualGridSize; i++) {
            for (let j = 0; j < actualGridSize; j++) {
                // Find the vertex index in the geometry
                const vertexIdx = (i * actualGridSize + j) * 3; // *3 because each vertex has x,y,z
                
                if (vertexIdx < vertices.length) {
                    // Apply subtle height variation to the floor
                    // Y is actually Z in our case because we rotated the plane
                    vertices[vertexIdx + 2] = window.terrainHeightData[i][j] * 0.5; // Subtle height variation
                }
            }
        }
        
        // Update the geometry
        floor.geometry.attributes.position.needsUpdate = true;
        floor.geometry.computeVertexNormals();
    }
    
    scene.add(floor);
    walls.push(floor);
}

// Create terrain based on heightmap data
function createHeightmapTerrain() {
    const actualGridSize = maze.length;
    
    // Generate mountains/terrain features based on maze data and heightmap
    for (let i = 0; i < actualGridSize; i++) {
        for (let j = 0; j < actualGridSize; j++) {
            if (maze[i][j] === 1) { // If it's a mountain/obstacle in our grid
                // Determine height based on heightmap data if available
                let height = 3.0; // Default height
                if (window.terrainHeightData && window.terrainHeightData[i] && typeof window.terrainHeightData[i][j] !== 'undefined') {
                    // Scale height based on heightmap value (0.0-1.0)
                    // Higher values in heightmap = taller mountains
                    height = 1.5 + window.terrainHeightData[i][j] * 4.0; // Height between 1.5 and 5.5
                }
                
                // Create mountain geometry with variable height
                const mountainGeometry = new THREE.BoxGeometry(2, height, 2);
                
                // Color varies with height - higher terrain is more brownish
                const colorValue = 0.5 + (window.terrainHeightData?.[i]?.[j] || 0.5) * 0.5;
                const mountainColor = new THREE.Color(
                    0.55 * colorValue, // R
                    0.27 * colorValue, // G
                    0.07 * colorValue  // B - More brown for higher terrain
                );
                
                // Create mountain material (texture removed)
                const mountainMaterial = new THREE.MeshStandardMaterial({
                    color: mountainColor,
                    roughness: 0.85,
                    metalness: 0.15
                });
                
                const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
                
                // Position calculation
                mountain.position.set(
                    i * 2 - actualGridSize + 1, // X
                    height / 2, // Y (half height to sit on ground)
                    j * 2 - actualGridSize + 1  // Z
                );
                
                // Add random rotation for more natural look
                mountain.rotation.y = Math.random() * Math.PI * 2;
                
                // Random scaling for width/depth (but not height)
                const scaleXZ = 0.7 + Math.random() * 0.6; // Between 0.7 and 1.3
                mountain.scale.set(
                    scaleXZ, 
                    1.0,    // Keep original height 
                    scaleXZ
                );
                
                mountain.castShadow = true;
                mountain.receiveShadow = true;
                scene.add(mountain);
                walls.push(mountain);
            }
        }
    }
}

// Override the clearMazeWalls function
window.clearMazeWalls = function() {
    if (scene && walls && walls.length > 0) {
        console.log("Clearing Mars terrain elements. Count:", walls.length);
        walls.forEach(element => {
            scene.remove(element);
            // Optional: Dispose geometry and material if memory becomes an issue
            // if (element.geometry) element.geometry.dispose();
            // if (element.material) element.material.dispose();
        });
        walls.length = 0; // Clear the array
    } else {
        console.log("clearMazeWalls: No elements to clear or scene/walls array not available.");
    }
};

// Log that we've overridden the functions
console.log("Heightmap-based Mars terrain generation is now active and has overridden the original maze functions."); 