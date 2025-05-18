// Audio system for game sounds

// Sound effects cache
const soundEffects = {};
let soundsLoading = new Set(); // Track which sounds are currently loading

// Initialize audio context
let audioContext;
let walkingSound;
let isWalkingSoundPlaying = false;
let lastMovementTime = 0;
const MOVEMENT_TIMEOUT = 100; // Time in ms to wait before stopping walking sound

// Initialize the audio system
async function initAudio() {
    try {
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume audio context if suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        // Load all sound effects
        await loadSound('shoot', 'sound/shoot.mp3');
        await loadSound('shoot_local', 'sound/shoot.mp3'); // Load the same shoot sound with a different identifier
        await loadSound('walk', 'sound/walk.mp3');
        await loadSound('walk_local', 'sound/walk.mp3'); // Load the same walk sound with a different identifier
        await loadSound('hazard_damage', 'sound/hazard_damage.mp3');
        
        // Load walking sound
        //await loadSound('walking', 'sound/walk.mp3');
        
        console.log('Audio system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize audio system:', error);
    }
}

// Load a sound file
async function loadSound(name, url) {
    // If sound is already loading, wait for it
    if (soundsLoading.has(name)) {
        console.log(`Sound '${name}' is already loading, waiting...`);
        return;
    }

    // If sound is already loaded, no need to load again
    if (soundEffects[name]) {
        console.log(`Sound '${name}' is already loaded`);
        return;
    }

    soundsLoading.add(name);
    
    try {
        console.log(`Loading sound '${name}' from ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        soundEffects[name] = audioBuffer;
        console.log(`Sound '${name}' loaded successfully`);
    } catch (error) {
        // Try alternative URL if the first one fails
        try {
            const altUrl = url.startsWith('sound/') ? url.substring(6) : 'sound/' + url;
            console.log(`Trying alternative path: ${altUrl}`);
            const response = await fetch(altUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            soundEffects[name] = audioBuffer;
            console.log(`Sound '${name}' loaded successfully from alternative path`);
        } catch (altError) {
            // Sound file not found, mark it as unavailable to prevent further load attempts
            soundEffects[name] = null;
            console.log(`Sound '${name}' not available - continuing without sound`);
        }
    } finally {
        soundsLoading.delete(name);
    }
}

// Keep track of looping sounds
const loopingSounds = {};

// Play a loaded sound with optional looping
function playSound(name, shouldLoop = false) {
    if (!audioContext) {
        console.log('Audio context not initialized, initializing...');
        initAudio().then(() => {
            attemptPlaySound(name, shouldLoop);
        }).catch(error => {
            console.error('Failed to initialize audio:', error);
        });
        return;
    }

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        console.log('Audio context suspended, resuming...');
        audioContext.resume().then(() => {
            console.log('Audio context resumed successfully');
            attemptPlaySound(name, shouldLoop);
        }).catch(error => {
            console.error('Failed to resume audio context:', error);
        });
        return;
    }

    attemptPlaySound(name, shouldLoop);
}

// Helper function to actually play the sound
function attemptPlaySound(name, shouldLoop = false) {
    // If the sound is still loading, wait for it
    if (soundsLoading.has(name)) {
        console.log(`Sound '${name}' is still loading, waiting to play...`);
        return;
    }

    // If the sound isn't loaded yet, try to load it
    if (!soundEffects[name]) {
        // Only try to load if we haven't already marked it as unavailable (null)
        if (soundEffects[name] !== null) {
            console.log(`Sound '${name}' not loaded, attempting to load...`);
            loadSound(name, `sound/${name}.mp3`).then(() => {
                if (soundEffects[name]) {
                    attemptPlaySound(name, shouldLoop);
                }
            });
        }
        return;
    }

    try {
        // If this is a looping sound that's already playing, don't start it again
        if (shouldLoop && loopingSounds[name] && loopingSounds[name].isPlaying) {
            return;
        }

        // Create a new buffer source
        const source = audioContext.createBufferSource();
        source.buffer = soundEffects[name];
        
        // Set looping if requested
        source.loop = shouldLoop;
        
        // Create a gain node for volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.5; // Set volume to 50%
        
        // Connect nodes: source -> gain -> destination
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start playing
        source.start(0);
        console.log(`Playing sound '${name}' ${shouldLoop ? '(looping)' : ''}`);

        // If this is a looping sound, store it for later reference
        if (shouldLoop) {
            if (loopingSounds[name]) {
                // Stop the old looping sound if it exists
                stopSound(name);
            }
            loopingSounds[name] = {
                source,
                gainNode,
                isPlaying: true
            };
        }
    } catch (error) {
        console.error(`Error playing sound '${name}':`, error);
    }
}

// Stop a looping sound
function stopSound(name) {
    if (loopingSounds[name] && loopingSounds[name].isPlaying) {
        try {
            loopingSounds[name].source.stop();
            loopingSounds[name].isPlaying = false;
            console.log(`Stopped sound '${name}'`);
        } catch (error) {
            console.error(`Error stopping sound '${name}':`, error);
        }
    }
}

// Resume audio context if it was suspended (needed for Chrome's autoplay policy)
async function resumeAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log('Audio context resumed successfully');
        } catch (error) {
            console.error('Error resuming audio context:', error);
        }
    }
}

function playWalkingSound() {
    if (!audioContext || !walkingSound) return;
    
    lastMovementTime = Date.now();
    
    if (!isWalkingSoundPlaying) {
        isWalkingSoundPlaying = true;
        
        function playLoop() {
            if (!isWalkingSoundPlaying) return;
            
            const source = audioContext.createBufferSource();
            source.buffer = walkingSound;
            source.connect(audioContext.destination);
            source.start();
            
            // Check if player is still moving
            source.onended = () => {
                const timeSinceLastMovement = Date.now() - lastMovementTime;
                if (timeSinceLastMovement < MOVEMENT_TIMEOUT && isWalkingSoundPlaying) {
                    playLoop();
                } else {
                    isWalkingSoundPlaying = false;
                }
            };
        }
        
        playLoop();
    }
}

function stopWalkingSound() {
    isWalkingSoundPlaying = false;
}

function updateWalkingSound() {
    // Check if player is moving (these variables should be accessible from main.js)
    if (moveForward || moveBackward || moveLeft || moveRight) {
        playWalkingSound();
    } else {
        // Don't stop immediately, let the MOVEMENT_TIMEOUT handle it
        lastMovementTime = Date.now() - MOVEMENT_TIMEOUT;
    }
}
// Export functions
window.initAudio = initAudio;
window.playSound = playSound;
window.stopSound = stopSound;
window.resumeAudio = resumeAudio; 