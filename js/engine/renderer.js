/**
 * VoxelCraft Optimized - Renderer Module
 * Handles all rendering optimizations and visual effects
 */

'use strict';

class VoxelRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = null;
        this.composer = null;
        this.renderTarget = null;
        
        // Performance settings
        this.settings = {
            antialias: false,
            shadows: false,
            postProcessing: false,
            pixelRatio: 1,
            anisotropy: 1
        };
        
        // Stats tracking
        this.stats = {
            drawCalls: 0,
            triangles: 0,
            points: 0,
            lines: 0,
            frameTime: 0
        };
        
        this.init();
    }
    
    init() {
        // Create WebGL renderer with optimizations
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.settings.antialias,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: false,
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false
        });
        
        // Configure renderer
        this.configureRenderer();
        
        // Setup render targets for post-processing
        if (this.settings.postProcessing) {
            this.setupPostProcessing();
        }
    }
    
    configureRenderer() {
        // Basic settings
        this.renderer.setPixelRatio(this.settings.pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Shadow settings
        this.renderer.shadowMap.enabled = this.settings.shadows;
        if (this.settings.shadows) {
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = false;
        }
        
        // Performance optimizations
        this.renderer.sortObjects = true;
        this.renderer.autoClear = true;
        this.renderer.autoClearColor = true;
        this.renderer.autoClearDepth = true;
        this.renderer.autoClearStencil = false;
        
        // Color management
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Texture settings
        this.renderer.capabilities.maxTextures = Math.min(
            this.renderer.capabilities.maxTextures,
            16
        );
        
        // Get max anisotropy
        const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
        this.settings.anisotropy = Math.min(this.settings.anisotropy, maxAnisotropy);
    }
    
    setupPostProcessing() {
        // Create render target
        this.renderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                stencilBuffer: false,
                depthBuffer: true
            }
        );
        
        // Note: EffectComposer would be imported separately in production
        // For now, we'll use standard rendering
    }
    
    render(scene, camera) {
        // Update stats
        this.renderer.info.autoReset = false;
        this.renderer.info.reset();
        
        // Render scene
        if (this.settings.postProcessing && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(scene, camera);
        }
        
        // Update stats
        this.updateStats();
    }
    
    updateStats() {
        const info = this.renderer.info;
        this.stats.drawCalls = info.render.calls;
        this.stats.triangles = info.render.triangles;
        this.stats.points = info.render.points;
        this.stats.lines = info.render.lines;
        this.stats.frameTime = info.render.frame;
    }
    
    resize(width, height) {
        this.renderer.setSize(width, height);
        
        if (this.renderTarget) {
            this.renderTarget.setSize(width, height);
        }
        
        if (this.composer) {
            this.composer.setSize(width, height);
        }
    }
    
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        this.configureRenderer();
    }
    
    dispose() {
        this.renderer.dispose();
        
        if (this.renderTarget) {
            this.renderTarget.dispose();
        }
    }
    
    getInfo() {
        return {
            ...this.stats,
            memory: this.renderer.info.memory,
            programs: this.renderer.info.programs ? this.renderer.info.programs.length : 0
        };
    }
}

// Export
window.VoxelRenderer = VoxelRenderer;