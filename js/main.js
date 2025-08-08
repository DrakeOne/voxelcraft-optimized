/**
 * VoxelCraft Optimized - Main Entry Point
 * Version: 0.0.1
 * Ultra-optimized voxel game engine for web browsers
 */

'use strict';

// Global game state
const GameState = {
    version: '0.0.1',
    isRunning: false,
    isPaused: false,
    isMobile: false,
    settings: {
        renderDistance: 4, // chunks
        fov: 75,
        mouseSensitivity: 0.002,
        touchSensitivity: 0.003,
        maxFPS: 60,
        enableShadows: false, // Disabled for performance
        enablePostProcessing: false,
        chunkSize: 16,
        worldHeight: 64,
        enableDebug: false
    },
    performance: {
        fps: 0,
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
        memory: 0,
        chunks: 0,
        blocks: 0
    }
};

// Main Game Class
class VoxelCraftGame {
    constructor() {
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.world = null;
        this.controls = null;
        this.hud = null;
        this.clock = null;
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
        
        // Performance monitoring
        this.stats = {
            lastFrameTime: performance.now(),
            deltaTime: 0,
            smoothFPS: 60
        };
        
        // Object pools for memory optimization
        this.pools = {
            vectors: [],
            matrices: [],
            quaternions: []
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('Starting VoxelCraft initialization...');
            
            // Initialize Three.js clock
            if (typeof THREE !== 'undefined') {
                this.clock = new THREE.Clock();
            } else {
                throw new Error('Three.js not loaded');
            }
            
            // Show loading screen
            this.updateLoadingStatus('Detecting device capabilities...');
            
            // Detect device type
            this.detectDevice();
            
            // Initialize WebGL renderer with optimizations
            this.updateLoadingStatus('Initializing renderer...');
            await this.initRenderer();
            
            // Setup scene and camera
            this.updateLoadingStatus('Setting up scene...');
            this.setupScene();
            
            // Initialize world generation
            this.updateLoadingStatus('Generating world...');
            await this.initWorld();
            
            // Setup controls based on device
            this.updateLoadingStatus('Setting up controls...');
            this.initControls();
            
            // Initialize HUD
            this.updateLoadingStatus('Initializing HUD...');
            this.initHUD();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Hide loading screen
            this.hideLoadingScreen();
            
            // Start game loop
            GameState.isRunning = true;
            this.animate();
            
            console.log(`VoxelCraft ${GameState.version} initialized successfully!`);
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError('Failed to initialize game: ' + error.message);
        }
    }
    
    detectDevice() {
        // Detect mobile device
        GameState.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                            ('ontouchstart' in window) ||
                            (navigator.maxTouchPoints > 0);
        
        // Adjust settings for mobile
        if (GameState.isMobile) {
            GameState.settings.renderDistance = 3;
            GameState.settings.maxFPS = 30;
            document.getElementById('mobileControls').style.display = 'block';
        }
        
        // Detect WebGL capabilities
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        
        if (!gl) {
            throw new Error('WebGL not supported');
        }
        
        // Get device capabilities
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            console.log(`GPU: ${vendor} - ${renderer}`);
        }
        
        // Check for important extensions
        const extensions = {
            anisotropic: gl.getExtension('EXT_texture_filter_anisotropic'),
            instancedArrays: gl.getExtension('ANGLE_instanced_arrays'),
            vao: gl.getExtension('OES_vertex_array_object'),
            standardDerivatives: gl.getExtension('OES_standard_derivatives')
        };
        
        console.log('WebGL Extensions:', Object.keys(extensions).filter(key => extensions[key]));
    }
    
    async initRenderer() {
        const canvas = document.getElementById('gameCanvas');
        
        // Create optimized renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: !GameState.isMobile, // Disable AA on mobile for performance
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: false,
            preserveDrawingBuffer: false
        });
        
        // Renderer optimizations
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, GameState.isMobile ? 1.5 : 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = GameState.settings.enableShadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false; // Manual shadow updates for performance
        
        // Additional optimizations
        this.renderer.sortObjects = true;
        this.renderer.autoClear = true;
        this.renderer.autoClearColor = true;
        this.renderer.autoClearDepth = true;
        this.renderer.autoClearStencil = false;
        
        // Set output encoding
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.NoToneMapping; // Disable for performance
        
        // Enable renderer info for debugging
        this.renderer.info.autoReset = false;
    }
    
    setupScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, GameState.settings.renderDistance * GameState.settings.chunkSize * 2);
        
        // Setup camera with optimized settings
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(
            GameState.settings.fov,
            aspect,
            0.1,
            GameState.settings.renderDistance * GameState.settings.chunkSize * 3
        );
        this.camera.position.set(0, 20, 0);
        
        // Add optimized lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 0.5).normalize();
        
        if (GameState.settings.enableShadows) {
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 1024;
            directionalLight.shadow.mapSize.height = 1024;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 500;
            directionalLight.shadow.bias = -0.0005;
        }
        
        this.scene.add(directionalLight);
        
        // Sky gradient background
        const skyGeo = new THREE.SphereGeometry(500, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xffffff) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }
    
    async initWorld() {
        // Initialize world with terrain generation
        if (typeof World !== 'undefined') {
            this.world = new World(this.scene);
            await this.world.generate();
            
            // Update performance stats
            GameState.performance.chunks = this.world.chunks.size;
            GameState.performance.blocks = this.world.getBlockCount();
        } else {
            console.warn('World class not loaded, creating placeholder');
            // Create a simple placeholder ground
            const geometry = new THREE.BoxGeometry(100, 1, 100);
            const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
            const ground = new THREE.Mesh(geometry, material);
            ground.position.y = -1;
            this.scene.add(ground);
        }
    }
    
    initControls() {
        if (GameState.isMobile && typeof MobileControls !== 'undefined') {
            this.controls = new MobileControls(this.camera);
        } else if (typeof DesktopControls !== 'undefined') {
            this.controls = new DesktopControls(this.camera, this.renderer.domElement);
        } else {
            console.warn('Controls not loaded, using basic controls');
            // Basic fallback controls
            this.controls = {
                init: () => {},
                update: () => {}
            };
        }
        
        this.controls.init();
    }
    
    initHUD() {
        if (typeof HUD !== 'undefined') {
            this.hud = new HUD();
            this.hud.init();
        } else {
            console.warn('HUD not loaded');
        }
    }
    
    setupEventListeners() {
        // Window resize handler with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
        
        // Visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                GameState.isPaused = true;
            } else {
                GameState.isPaused = false;
                this.clock.start();
            }
        });
        
        // Debug toggle
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                GameState.settings.enableDebug = !GameState.settings.enableDebug;
                const debugInfo = document.getElementById('debugInfo');
                if (debugInfo) {
                    debugInfo.classList.toggle('active');
                }
            }
        });
        
        // Performance monitoring
        if (window.performance && window.performance.memory) {
            setInterval(() => {
                GameState.performance.memory = Math.round(window.performance.memory.usedJSHeapSize / 1048576);
            }, 1000);
        }
    }
    
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    animate() {
        if (!GameState.isRunning) return;
        
        // Request next frame
        requestAnimationFrame(() => this.animate());
        
        // Skip if paused
        if (GameState.isPaused) return;
        
        // Calculate delta time
        const currentTime = performance.now();
        this.stats.deltaTime = (currentTime - this.stats.lastFrameTime) / 1000;
        this.stats.lastFrameTime = currentTime;
        
        // Frame rate limiting
        const targetFrameTime = 1000 / GameState.settings.maxFPS;
        if (currentTime - this.stats.lastFrameTime < targetFrameTime) {
            return;
        }
        
        // Update game logic
        this.update(this.stats.deltaTime);
        
        // Render frame
        this.render();
        
        // Update FPS counter
        this.updateFPS(currentTime);
    }
    
    update(deltaTime) {
        // Update controls
        if (this.controls) {
            this.controls.update(deltaTime);
        }
        
        // Update world
        if (this.world && this.world.update) {
            this.world.update(this.camera.position, deltaTime);
        }
        
        // Update HUD
        if (this.hud) {
            this.hud.update(GameState.performance);
        }
    }
    
    render() {
        // Clear renderer info for accurate stats
        this.renderer.info.reset();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Update performance stats
        GameState.performance.drawCalls = this.renderer.info.render.calls;
        GameState.performance.triangles = this.renderer.info.render.triangles;
    }
    
    updateFPS(currentTime) {
        this.frameCount++;
        
        if (currentTime >= this.lastFPSUpdate + 1000) {
            GameState.performance.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFPSUpdate));
            this.frameCount = 0;
            this.lastFPSUpdate = currentTime;
            
            // Update FPS display
            const fpsElement = document.getElementById('fpsCounter');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${GameState.performance.fps}`;
            }
        }
    }
    
    updateLoadingStatus(message) {
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    showError(message) {
        const errorText = document.getElementById('errorText');
        if (errorText) {
            errorText.textContent = message;
            errorText.style.display = 'block';
        }
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = 'Error occurred';
            loadingText.style.color = '#ff4444';
        }
    }
    
    // Object pool methods for memory optimization
    getPooledVector3() {
        return this.pools.vectors.pop() || new THREE.Vector3();
    }
    
    releaseVector3(vector) {
        vector.set(0, 0, 0);
        this.pools.vectors.push(vector);
    }
    
    getPooledMatrix4() {
        return this.pools.matrices.pop() || new THREE.Matrix4();
    }
    
    releaseMatrix4(matrix) {
        matrix.identity();
        this.pools.matrices.push(matrix);
    }
}

// Initialize game immediately when this script loads
// Don't wait for DOMContentLoaded since we're loading dynamically
if (typeof THREE !== 'undefined') {
    console.log('Initializing VoxelCraft Game...');
    window.game = new VoxelCraftGame();
} else {
    console.error('Three.js is required but not loaded');
    const errorText = document.getElementById('errorText');
    if (errorText) {
        errorText.textContent = 'Three.js library not loaded. Please refresh the page.';
        errorText.style.display = 'block';
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VoxelCraftGame, GameState };
}