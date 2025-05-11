// js/player_model.js

/**
 * Creates a more detailed robot-like player model with tank-like legs.
 * @param {number} [color=0x666666] - The base color for the player model.
 * @returns {THREE.Group} The player model group.
 */
function createRobotPlayerModel(color = 0x666666) {
    const playerGroup = new THREE.Group();

    // Define materials with slight variations
    const primaryColor = new THREE.Color(color);
    const secondaryColor = new THREE.Color(color).offsetHSL(0, -0.1, -0.1); // Slightly darker/desaturated
    const accentColor = new THREE.Color(0x444444); // For tracks and joints
    const visorColor = new THREE.Color(0x00ffff);

    const primaryMaterial = new THREE.MeshStandardMaterial({ color: primaryColor.getHex(), roughness: 0.5, metalness: 0.4 });
    const secondaryMaterial = new THREE.MeshStandardMaterial({ color: secondaryColor.getHex(), roughness: 0.6, metalness: 0.3 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor.getHex(), roughness: 0.8, metalness: 0.1 });
    const visorMaterial = new THREE.MeshStandardMaterial({ color: visorColor.getHex(), emissive: visorColor.getHex(), emissiveIntensity: 0.6 });

    const trackHeight = 0.4;
    const trackWidth = 0.3; // Slightly narrower
    const trackLength = 0.9;
    const trackYPos = trackHeight / 2;

    // --- Treads / Legs ---
    const leftTrackGroup = new THREE.Group();
    const rightTrackGroup = new THREE.Group();

    const mainTrackShape = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, trackHeight, trackLength), accentMaterial);
    leftTrackGroup.add(mainTrackShape.clone());
    rightTrackGroup.add(mainTrackShape.clone());

    // Add "wheels" to tracks for detail
    const wheelRadius = trackHeight * 0.35;
    const wheelDepth = trackWidth * 0.6;
    const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelDepth, 12);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });

    const wheelPositions = [-trackLength * 0.35, 0, trackLength * 0.35]; // Front, middle, back
    wheelPositions.forEach(posZ => {
        const lWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        lWheel.rotation.z = Math.PI / 2; // Orient cylinder correctly
        lWheel.position.set(0, 0, posZ);
        leftTrackGroup.add(lWheel);

        const rWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        rWheel.rotation.z = Math.PI / 2;
        rWheel.position.set(0, 0, posZ);
        rightTrackGroup.add(rWheel);
    });
    
    const trackSeparation = 0.35 + trackWidth / 2; // Half of torso width + half of track width
    leftTrackGroup.position.set(-trackSeparation, trackYPos, 0);
    rightTrackGroup.position.set(trackSeparation, trackYPos, 0);
    playerGroup.add(leftTrackGroup);
    playerGroup.add(rightTrackGroup);

    // --- Torso ---
    const torsoHeight = 0.9;
    const torsoWidth = 0.7;
    const torsoDepth = 0.5;
    const torsoYPos = trackHeight + torsoHeight / 2;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth), primaryMaterial);
    torso.position.y = torsoYPos;
    playerGroup.add(torso);

    // Add some detail to torso (e.g., a slightly inset panel)
    const torsoPanelGeom = new THREE.BoxGeometry(torsoWidth * 0.8, torsoHeight * 0.6, torsoDepth * 0.3);
    const torsoPanel = new THREE.Mesh(torsoPanelGeom, secondaryMaterial);
    torsoPanel.position.set(0, 0, torsoDepth * 0.25); // Slightly forward
    torso.add(torsoPanel);


    // --- Neck ---
    const neckHeight = 0.15;
    const neckRadius = 0.1;
    const neckYPos = torsoYPos + torsoHeight / 2 + neckHeight / 2;
    const neckGeometry = new THREE.CylinderGeometry(neckRadius, neckRadius, neckHeight, 8);
    const neck = new THREE.Mesh(neckGeometry, accentMaterial);
    neck.position.y = neckYPos;
    playerGroup.add(neck);

    // --- Head ---
    const headSize = 0.4;
    const headYPos = neckYPos + neckHeight / 2 + headSize / 2;
    const headGeometry = new THREE.BoxGeometry(headSize, headSize, headSize * 0.9); // Slightly less deep
    const head = new THREE.Mesh(headGeometry, primaryMaterial);
    head.position.y = headYPos;
    playerGroup.add(head);

    // Visor
    const visorWidth = headSize * 0.7;
    const visorHeight = headSize * 0.25;
    const visorDepth = 0.05;
    const visorGeometry = new THREE.BoxGeometry(visorWidth, visorHeight, visorDepth);
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, headSize * 0.1, (headSize * 0.9 / 2) + visorDepth/2 - 0.01); // Front of the head
    head.add(visor);

    // --- Arms & Shoulders ---
    const armLength = 0.7;
    const armRadius = 0.12;
    const armYPos = torsoYPos + torsoHeight / 2 - 0.3; // Adjusted shoulder height
    const armXOffset = torsoWidth / 2 + armRadius * 0.3; // Closer to body

    // Shoulder Pauldrons
    const pauldronWidth = armRadius * 2.8;
    const pauldronHeight = armRadius * 2.5;
    const pauldronDepth = torsoDepth * 0.6;
    const pauldronGeometry = new THREE.BoxGeometry(pauldronWidth, pauldronHeight, pauldronDepth);
    
    const leftPauldron = new THREE.Mesh(pauldronGeometry, secondaryMaterial);
    leftPauldron.position.set(-(torsoWidth/2 - pauldronWidth/2 + 0.12), armYPos + pauldronHeight*0.2, 0);
    leftPauldron.rotation.z = Math.PI / 12;
    torso.add(leftPauldron);

    const rightPauldron = new THREE.Mesh(pauldronGeometry, secondaryMaterial);
    rightPauldron.position.set((torsoWidth/2 - pauldronWidth/2 + 0.12), armYPos + pauldronHeight*0.2, 0);
    rightPauldron.rotation.z = -Math.PI / 12;
    torso.add(rightPauldron);

    // Left Arm (Cylinder)
    const armGeometry = new THREE.CylinderGeometry(armRadius, armRadius * 0.8, armLength, 8);
    const leftArm = new THREE.Mesh(armGeometry, secondaryMaterial);
    leftArm.position.set(-armXOffset, armYPos, 0);
    leftArm.rotation.z = Math.PI / 8; // Angled down
    playerGroup.add(leftArm);

    // Right Arm - Gun
    const gunGroup = new THREE.Group();
    gunGroup.position.set(armXOffset, armYPos, 0.1); // Positioned similarly to left arm, slightly forward
    gunGroup.rotation.z = -Math.PI / 24; // Slightly angled down, mostly forward
    playerGroup.add(gunGroup);

    const gunBaseLength = armLength * 0.5;
    const gunBaseRadius = armRadius * 1.0;
    const gunBaseGeometry = new THREE.CylinderGeometry(gunBaseRadius, armRadius * 0.9, gunBaseLength, 8);
    const gunBase = new THREE.Mesh(gunBaseGeometry, accentMaterial);
    gunBase.rotation.x = Math.PI / 2;
    gunBase.position.z = gunBaseLength / 2;
    gunGroup.add(gunBase);

    const barrelLength = armLength * 0.7;
    const barrelRadius = armRadius * 0.5;
    const barrelGeometry = new THREE.CylinderGeometry(barrelRadius, barrelRadius, barrelLength, 6);
    const barrel = new THREE.Mesh(barrelGeometry, secondaryMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = gunBaseLength + barrelLength / 2 - 0.1; // Attach to front of base
    gunGroup.add(barrel);
    
    // Small detail on gun base
    const gunDetailGeom = new THREE.BoxGeometry(gunBaseRadius*1.5, gunBaseRadius*0.5, gunBaseLength*0.5);
    const gunDetail = new THREE.Mesh(gunDetailGeom, primaryMaterial);
    gunDetail.position.y = gunBaseRadius * 0.6;
    gunDetail.position.z = gunBaseLength * 0.4;
    gunBase.add(gunDetail);


    // Store parts for potential animation
    playerGroup.userData.torso = torso;
    playerGroup.userData.head = head;
    playerGroup.userData.leftTrackGroup = leftTrackGroup;
    playerGroup.userData.rightTrackGroup = rightTrackGroup;
    playerGroup.userData.leftArm = leftArm;
    playerGroup.userData.rightArm = gunGroup;
    playerGroup.userData.gunBarrel = barrel;
    playerGroup.userData.isMoving = false;
    playerGroup.userData.animationTime = 0;

    // Overall model properties
    playerGroup.castShadow = true;
    playerGroup.receiveShadow = true;
    playerGroup.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Model's logical base is at y=0 of the playerGroup.
    // Total height is roughly headYPos + headSize/2, which is approx 0.4 + 1.0 + 0.15 + 0.4 = 1.95
    // This is a bit taller than before, but the visual center might be lower.

    // Rotate the entire group so its defined "front" (visor/gun) aligns with the direction
    // expected when rotation.y = 0 (which is typically looking down -Z world axis).
    // If our model's front is along its local +Z, we need to turn it 180 degrees.
    playerGroup.rotation.y = Math.PI;

    return playerGroup;
}

/**
 * Animates the robot player model's walking motion.
 * @param {THREE.Group} playerModel - The player model group.
 * @param {number} delta - Time delta for animation.
 */
function animateRobotPlayerWalk(playerModel, delta) {
    if (!playerModel.userData.isMoving) {
        // Reset to neutral if not moving? Or just stop.
        // For a simple tread animation, we might not need a reset if it's continuous.
        return;
    }

    playerModel.userData.animationTime += delta * 5; // Adjust speed of animation

    // Simple back and forth for treads (illusion of movement)
    // This is a very basic example. Real tread animation is complex.
    // We'll animate the "wheels" by rotating them.
    const wheelSpinSpeed = playerModel.userData.animationTime * 2; // Make wheels spin faster

    const animateTrack = (trackGroup) => {
        trackGroup.children.forEach(child => {
            if (child.geometry instanceof THREE.CylinderGeometry) { // It's a wheel
                child.rotation.x = wheelSpinSpeed; // Spin around their local X axis
            }
        });
    };

    animateTrack(playerModel.userData.leftTrackGroup);
    animateTrack(playerModel.userData.rightTrackGroup);
    
    // Optional: Add arm swing
    const armSwayAngle = Math.PI / 12;
    // Only swing left arm if right arm is a gun
    playerModel.userData.leftArm.rotation.x = Math.sin(playerModel.userData.animationTime * 0.5) * armSwayAngle;
    
    // Right arm (gun) remains relatively steady or aims, no default swing for now.
    // A subtle recoil or aiming animation could be added here based on a "isShooting" flag.

    // Could also add subtle torso bobbing
    // const torsoBaseY = trackHeight + (1.0 / 2); // Recalculate based on new torsoHeight
    // playerModel.userData.torso.position.y = torsoBaseY + Math.sin(playerModel.userData.animationTime * 2) * 0.02;
}