// Game Configuration

// Maze
const MAZE_SIZE = 15; // Increased maze size

// Player
let PLAYER_HEALTH_INITIAL = 100; // Use 'let' if it's reset, 'const' if only initial
const PLAYER_SPEED = 5.0;
const PLAYER_EYE_LEVEL = 1.2; // Reduced for smaller feel

// Mouse Controls
const MOUSE_SENSITIVITY = 0.002;
const MIN_PITCH = -Math.PI / 2 + 0.01; //radians, slightly more than -90 degrees
const MAX_PITCH = Math.PI / 2 - 0.01;  //radians, slightly less than +90 degrees


// Enemies
const ENEMY_COUNT = 3;
const ENEMY_HEALTH_INITIAL = 100;
const ENEMY_MOVE_SPEED = 1.0;
const ENEMY_ATTACK_RANGE = 1.5;
const ENEMY_DETECTION_RANGE = 15;
const ENEMY_ATTACK_DAMAGE_PER_SECOND = 10; // Damage applied per second of contact
const ENEMY_SPHERE_RADIUS = 0.1;
const ENEMY_GEOMETRY_ARGS = [ENEMY_SPHERE_RADIUS, 16, 16]; // radius, widthSegments, heightSegments
const ENEMY_HEALTH_BAR_GEOMETRY_ARGS = [0.6, 0.08]; // width, height
const ENEMY_HEALTH_BAR_Y_OFFSET = ENEMY_SPHERE_RADIUS + 0.2; // Position above the sphere
const WALL_HALF_THICKNESS = 1.0; // Walls are 2 units thick, so half is 1.0
const ENEMY_WALL_COLLISION_THRESHOLD = ENEMY_SPHERE_RADIUS + WALL_HALF_THICKNESS;

// Enemy Types Definition
// modelFunction will be assigned actual functions in enemy.js after scripts are loaded
const ENEMY_TYPES = {
    BASIC: {
        name: 'Crawler',
        color: 0xff0000, // Standard red
        healthFactor: 1.0, // Multiplier for ENEMY_HEALTH_INITIAL
        speedFactor: 1.0,  // Multiplier for ENEMY_MOVE_SPEED
        damageFactor: 1.0, // Multiplier for ENEMY_ATTACK_DAMAGE_PER_SECOND
        points: 100,
        specialAbility: null,
        modelKey: 'createBasicEnemyModel' // Key to look up function
    },
    FAST: {
        name: 'Sprinter',
        color: 0xffaa00, // Orange-ish
        healthFactor: 0.7,
        speedFactor: 1.8,
        damageFactor: 0.8,
        points: 150,
        specialAbility: null,
        modelKey: 'createFastEnemyModel'
    },
    TANK: {
        name: 'Behemoth',
        color: 0x8B0000, // Dark red
        healthFactor: 2.5,
        speedFactor: 0.6,
        damageFactor: 1.5,
        points: 250,
        specialAbility: null,
        modelKey: 'createTankEnemyModel'
    },
    RANGED: {
        name: 'Zapper',
        color: 0xFFFF00, // Yellow
        healthFactor: 0.8,
        speedFactor: 0.8,
        damageFactor: 0.5, // Damage is via projectile
        points: 200,
        specialAbility: 'shoot',
        shootCooldown: 3, // seconds
        shootRange: 10, // world units
        modelKey: 'createRangedEnemyModel'
    }
};

// Bullets
const BULLET_SPEED = 20;
const BULLET_DAMAGE = 25;
const BULLET_LIFESPAN = 1000; // milliseconds
const BULLET_GEOMETRY_ARGS = [0.1, 8, 8]; // radius, widthSegments, heightSegments

// Controls
const JOYSTICK_TURN_SENSITIVITY = 2;
const JOYSTICK_MOVEMENT_THRESHOLD = 0.2;

// Collision
// Player collision with wall: player is ~0.5 radius, wall is 1.0 radius from center.
// So, if distance between centers is < 1.5, it's a collision.
// Using 1.4 for a little leeway.
const PLAYER_WALL_COLLISION_THRESHOLD = 1.4;
// Bullet collision with wall: bullet is 0.1 radius, wall is 1.0 radius.
// Threshold < 1.1
const BULLET_WALL_COLLISION_THRESHOLD = 1.0;
// Bullet collision with enemy: bullet radius (0.1) + enemy sphere radius
const BULLET_RADIUS = 0.1; // Assuming from BULLET_GEOMETRY_ARGS[0]
const BULLET_ENEMY_COLLISION_RADIUS_SUM = BULLET_RADIUS + ENEMY_SPHERE_RADIUS;

// Colors
const SCENE_BACKGROUND_COLOR = 0x87CEEB;
const FLOOR_COLOR = 0x555555;
const WALL_COLOR = 0x8888ff;
const ENEMY_COLOR = 0xff0000;
const ENEMY_HEALTH_BAR_COLOR = 0x00ff00;
const BULLET_COLOR = 0xffff00;

// Power-up Types (effects are functions, will be defined where they can access game state)
// Note: The actual effect functions involving player state modification
// (playerHealth, PLAYER_SPEED, currentWeaponLevel, playerShieldActive)
// will need to be carefully integrated into the main game logic or passed necessary references.
// For now, their definitions here are conceptual.
const POWERUP_TYPES = {
    HEALTH: {
        name: 'Health',
        color: 0x00ff00,
        // effect: (player) => { playerHealth = Math.min(playerHealth + 25, PLAYER_HEALTH_INITIAL); updateScoreDisplay(50); }
    },
    SPEED: {
        name: 'Speed',
        color: 0x0088ff,
        // effect: (player) => { ... apply speed boost ... updateScoreDisplay(25); }
    },
    WEAPON: {
        name: 'Weapon Upgrade',
        color: 0xff8800,
        // effect: (player) => { ... upgrade weapon ... updateScoreDisplay(75); }
    },
    SHIELD: {
        name: 'Shield',
        color: 0x8844ff,
        // effect: (player) => { ... apply shield ... updateScoreDisplay(100); }
    }
};

// Weapon Types (placeholder, to be defined with actual weapon properties)
const WEAPON_TYPES = [
    { name: "Basic Gun", damage: 25, fireRate: 0.2, projectileSpeed: 20, projectileColor: 0xffff00, level: 0 },
    // Add more weapon types later
];
let currentWeaponLevel = 0; // Initial weapon level