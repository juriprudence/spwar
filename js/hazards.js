// Enhanced Hazard Zones with Custom Shaders
// This implements advanced WebGL shaders for lava and acid effects

// Wait for THREE to be available
(function() {
    // Check if THREE is available
    if (typeof THREE === 'undefined') {
        console.error('THREE is not loaded yet. Waiting...');
        setTimeout(arguments.callee, 100);
        return;
    }

    // Detect mobile devices
    window.isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const HAZARD_TYPES = {
        LAVA: {
            name: 'Lava',
            baseColor: new THREE.Vector3(1.0, 0.3, 0.1),
            glowColor: new THREE.Vector3(1.0, 0.6, 0.0),
            flowSpeed: window.isMobileDevice ? 0.1 : 0.2, // Reduced flow speed on mobile
            noiseScale: window.isMobileDevice ? 2.0 : 3.0, // Reduced noise scale on mobile
            damage: 100, // Instant death
            yLevel: 0.2 // Height of the lava
        },
        ACID: {
            name: 'Acid',
            baseColor: new THREE.Vector3(0.3, 1.0, 0.0),
            glowColor: new THREE.Vector3(0.6, 1.0, 0.2),
            flowSpeed: window.isMobileDevice ? 0.25 : 0.5, // Reduced flow speed on mobile
            noiseScale: window.isMobileDevice ? 2.0 : 4.0, // Reduced noise scale on mobile
            damage: 100, // Instant death
            yLevel: 0.15 // Height of the acid
        }
    };

    const hazardZones = [];

    // Vertex shader for both lava and acid
    const hazardVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `;

    // Fragment shader for lava
    const lavaFragmentShader = `
    uniform vec3 baseColor;
    uniform vec3 glowColor;
    uniform float time;
    uniform float flowSpeed;
    uniform float noiseScale;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    // Simplex 3D Noise function
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) { 
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        // First corner
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 =   v - i + dot(i, C.xxx);
        
        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        
        // Permutations
        i = mod(i, 289.0); 
        vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        // Gradients
        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        // Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    void main() {
        // Create flowing lava effect with multiple layers of noise
        vec2 flowingUv = vUv + vec2(time * flowSpeed * 0.1, time * flowSpeed * -0.05);
        
        // Base noise for the lava pattern
        float noise1 = snoise(vec3(flowingUv * noiseScale, time * 0.1)) * 0.5 + 0.5;
        float noise2 = snoise(vec3(flowingUv * noiseScale * 2.0 + 100.0, time * 0.2)) * 0.5 + 0.5;
        
        // Create hot spots and cooler crust
        float crustPattern = snoise(vec3(flowingUv * noiseScale * 0.5, time * 0.05)) * 0.5 + 0.5;
        crustPattern = pow(crustPattern, 2.0);
        
        // Mix the noise layers
        float mixedNoise = mix(noise1, noise2, 0.5);
        mixedNoise = pow(mixedNoise, 1.5);
        
        // Create final color
        vec3 lavaCrustColor = vec3(0.2, 0.1, 0.05); // Dark crust
        vec3 hotLavaColor = glowColor * 1.5; // Extra bright hot spots
        
        // Mix between crust, base color, and hot spots
        vec3 finalColor = mix(lavaCrustColor, baseColor, mixedNoise);
        finalColor = mix(finalColor, hotLavaColor, pow(noise2, 4.0));
        
        // Edge glow effect
        float fresnelTerm = dot(vNormal, vec3(0.0, 1.0, 0.0));
        fresnelTerm = clamp(1.0 - fresnelTerm, 0.0, 1.0);
        fresnelTerm = pow(fresnelTerm, 3.0);
        
        // Add glow at edges
        finalColor += glowColor * fresnelTerm * 0.6;
        
        // Pulsing glow effect
        finalColor += glowColor * 0.2 * (sin(time * 2.0) * 0.5 + 0.5);
        
        gl_FragColor = vec4(finalColor, 1.0);
        
        // Add emissive glow with HDR effect
        gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(0.5)); // Gamma adjustment for better brightness
    }
    `;

    // Fragment shader for acid
    const acidFragmentShader = `
    uniform vec3 baseColor;
    uniform vec3 glowColor;
    uniform float time;
    uniform float flowSpeed;
    uniform float noiseScale;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    // Simplex 3D Noise function
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) { 
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        // First corner
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 =   v - i + dot(i, C.xxx);
        
        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        
        // Permutations
        i = mod(i, 289.0); 
        vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        // Gradients
        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        // Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    void main() {
        // Flowing bubbling acid effect
        vec2 flowingUv = vUv + vec2(sin(time * flowSpeed) * 0.01, cos(time * flowSpeed) * 0.01);
        
        // Create bubble patterns
        float bubble1 = snoise(vec3(flowingUv * noiseScale, time * 0.3)) * 0.5 + 0.5;
        float bubble2 = snoise(vec3(flowingUv * noiseScale * 3.0 + 100.0, time * 0.5)) * 0.5 + 0.5;
        float bubble3 = snoise(vec3(flowingUv * noiseScale * 1.5 + 300.0, time * 0.4)) * 0.5 + 0.5;
        
        // Create circular bubble shapes
        float bubbleMask = pow(bubble1, 3.0) * pow(bubble2, 2.0);
        float smallBubbles = step(0.65, bubble3);
        
        // Swirling motion
        vec2 swirlUv = flowingUv;
        float swirlIntensity = 0.2;
        float swirlFrequency = 3.0;
        swirlUv.x += sin(swirlUv.y * swirlFrequency + time) * swirlIntensity;
        swirlUv.y += cos(swirlUv.x * swirlFrequency + time) * swirlIntensity;
        
        float swirl = snoise(vec3(swirlUv * noiseScale * 0.5, time * 0.2));
        
        // Create depth variations
        float depth = mix(0.3, 1.0, bubble1);
        
        // Create final color
        vec3 acidDeepColor = baseColor * 0.4; // Darker base for depth
        vec3 bubbleColor = glowColor * 1.3; // Brighter bubble color
        
        // Combine colors for final effect
        vec3 finalColor = mix(acidDeepColor, baseColor, depth);
        finalColor = mix(finalColor, bubbleColor, smallBubbles * 0.7);
        finalColor += bubbleColor * bubbleMask * 0.3;
        
        // Add swirl pattern
        finalColor = mix(finalColor, bubbleColor, pow(abs(swirl), 8.0) * 0.3);
        
        // Caustic edge glow (refraction effect)
        float edgeFresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0))), 4.0);
        finalColor += glowColor * edgeFresnel * 0.4;
        
        // Pulsing glow effect
        float pulse = sin(time * 3.0) * 0.5 + 0.5;
        finalColor += glowColor * 0.1 * pulse;
        
        // Apply transparency for a more liquid look
        float alpha = 0.9;
        
        gl_FragColor = vec4(finalColor, alpha);
    }
    `;

    function createHazardZone(type, position, size) {
        const hazardData = HAZARD_TYPES[type];
        if (!hazardData) {
            console.error("Unknown hazard type:", type);
            return null;
        }

        // Select the appropriate shader based on hazard type
        const fragmentShader = type === 'LAVA' ? lavaFragmentShader : acidFragmentShader;
        
        // Create shader material with uniforms
        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseColor: { value: hazardData.baseColor },
                glowColor: { value: hazardData.glowColor },
                flowSpeed: { value: hazardData.flowSpeed },
                noiseScale: { value: hazardData.noiseScale }
            },
            vertexShader: hazardVertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        });

        // Create hazard mesh with reduced complexity on mobile
        const segments = window.isMobileDevice ? { x: 8, y: 2, z: 8 } : { x: 16, y: 4, z: 16 };
        const geometry = new THREE.BoxGeometry(size.x, hazardData.yLevel, size.z, segments.x, segments.y, segments.z);
        const hazard = new THREE.Mesh(geometry, shaderMaterial);
        
        hazard.position.copy(position);
        hazard.position.y = hazardData.yLevel / 2; // Position at half height
        hazard.hazardType = type;
        hazard.damage = hazardData.damage;
        
        // Create simplified effects for mobile
        if (type === 'LAVA' && !window.isMobileDevice) {
            // Add a simple glow plane beneath for extra light emission
            const glowGeometry = new THREE.PlaneGeometry(size.x * 1.05, size.z * 1.05);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xff3300,
                transparent: true,
                opacity: 0.15,
                blending: THREE.AdditiveBlending,
                emissive: 0xff3300,
                emissiveIntensity: 2.0
            });
            
            const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
            glowPlane.rotation.x = -Math.PI / 2;
            glowPlane.position.y = 0.02; // Just above ground
            hazard.add(glowPlane);
        } else if (type === 'LAVA' && window.isMobileDevice) {
            // Simplified glow for mobile
            const glowGeometry = new THREE.PlaneGeometry(size.x, size.z);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xff3300,
                transparent: true,
                opacity: 0.1,
                blending: THREE.AdditiveBlending
            });
            const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
            glowPlane.rotation.x = -Math.PI / 2;
            glowPlane.position.y = 0.01;
            hazard.add(glowPlane);
        }
        
        // Add simplified effects for acid type
        if (type === 'ACID' && !window.isMobileDevice) {
            // Full acid fog effect for desktop
            const fogGeometry = new THREE.PlaneGeometry(size.x, size.z, 1, 1);
            const fogMaterial = new THREE.MeshBasicMaterial({
                color: 0x88ff44,
                transparent: true,
                opacity: 0.1,
                blending: THREE.AdditiveBlending,
                emissive: 0x88ff44,
                emissiveIntensity: 1.5,
                side: THREE.DoubleSide
            });
            
            for (let i = 0; i < 3; i++) {
                const fogPlane = new THREE.Mesh(fogGeometry, fogMaterial.clone());
                fogPlane.rotation.x = -Math.PI / 2;
                fogPlane.position.y = hazardData.yLevel + 0.3 + i * 0.2;
                fogPlane.material.opacity = 0.07 - (i * 0.02);
                fogPlane.material.emissiveIntensity = 1.5 - (i * 0.3);
                hazard.add(fogPlane);
            }
        } else if (type === 'ACID' && window.isMobileDevice) {
            // Single layer fog effect for mobile
            const fogGeometry = new THREE.PlaneGeometry(size.x, size.z, 1, 1);
            const fogMaterial = new THREE.MeshBasicMaterial({
                color: 0x88ff44,
                transparent: true,
                opacity: 0.08,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });
            
            const fogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
            fogPlane.rotation.x = -Math.PI / 2;
            fogPlane.position.y = hazardData.yLevel + 0.3;
            hazard.add(fogPlane);
        }

        scene.add(hazard);
        hazardZones.push(hazard);

        return hazard;
    }

    function updateHazardEffects(delta) {
        // Update shader uniforms for all hazard zones
        // Slow down the time factor for mobile
        const time = performance.now() * 0.005; // Reduced from 0.01 for better performance
        
        // Only update every other frame on mobile devices
        if (window.isMobileDevice && Math.floor(time * 2) % 2 === 0) {
            return;
        }
        
        hazardZones.forEach(hazard => {
            if (hazard.material && hazard.material.uniforms) {
                hazard.material.uniforms.time.value = time;
            }
            
            // Update any additional effects
            if (hazard.hazardType === 'ACID') {
                // Reduce number of updates for fog planes on mobile
                if (!window.isMobileDevice || Math.floor(time) % 2 === 0) {
                    hazard.children.forEach((child, index) => {
                        if (child instanceof THREE.Mesh && child.material.opacity < 0.2) {
                            child.position.y = HAZARD_TYPES.ACID.yLevel + 0.1 + index * 0.15 + 
                                           Math.sin(time * 0.5 + index) * 0.05; // Reduced animation speed
                        }
                    });
                }
            }
            
            // Add pulsing for lava glow with reduced frequency
            if (hazard.hazardType === 'LAVA') {
                if (!window.isMobileDevice || Math.floor(time) % 2 === 0) {
                    hazard.children.forEach(child => {
                        if (child instanceof THREE.Mesh && child.material.opacity < 0.2) {
                            child.material.opacity = 0.1 + Math.sin(time) * 0.05; // Reduced frequency
                        }
                    });
                }
            }
        });
    }

    function checkHazardCollisions(playerPosition) {
        for (const hazard of hazardZones) {
            // Get hazard bounds
            const halfWidth = hazard.scale.x / 2;
            const halfDepth = hazard.scale.z / 2;
            
            // Check if player is within hazard bounds
            if (Math.abs(playerPosition.x - hazard.position.x) < halfWidth &&
                Math.abs(playerPosition.z - hazard.position.z) < halfDepth) {
                
                // Player is in hazard zone
                if (typeof playSound === 'function') {
                    playSound('hazard_damage');
                }
                
                // Kill player
                playerHealth = 0;
                if (typeof gameOver === 'function') {
                    gameOver();
                }
                
                return true;
            }
        }
        return false;
    }

    // Example of how to use:
    /*
    // Create a lava pool
    createHazardZone('LAVA', new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 0, 10));
    
    // Create an acid pool
    createHazardZone('ACID', new THREE.Vector3(15, 0, 0), new THREE.Vector3(8, 0, 8));
    
    // In your animation loop:
    function animate(time) {
        updateHazardEffects(clock.getDelta());
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    */

    // Export functions to global scope
    window.createHazardZone = createHazardZone;
    window.updateHazardEffects = updateHazardEffects;
    window.checkHazardCollisions = checkHazardCollisions;
    window.HAZARD_TYPES = HAZARD_TYPES;

    console.log('Advanced Hazards system with shaders initialized successfully');
})();