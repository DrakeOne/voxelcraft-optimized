/**
 * VoxelCraft Optimized - Terrain Generation
 * Procedural terrain generation using optimized noise functions
 */

'use strict';

// Simple noise function for terrain generation
class SimplexNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.perm = new Uint8Array(512);
        this.gradP = new Array(512);
        this.init();
    }
    
    init() {
        // Initialize permutation table
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        
        // Shuffle using seed
        let n = this.seed * 256;
        for (let i = 255; i > 0; i--) {
            n = (n + 31) % 256;
            const j = Math.floor((n / 256) * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        // Duplicate permutation table
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
        }
        
        // Gradients for 2D
        const grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        
        for (let i = 0; i < 512; i++) {
            this.gradP[i] = grad3[this.perm[i] % 12];
        }
    }
    
    noise2D(x, y) {
        // Simple 2D noise implementation
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = this.fade(x);
        const v = this.fade(y);
        
        const A = this.perm[X] + Y;
        const B = this.perm[X + 1] + Y;
        
        return this.lerp(v,
            this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
            this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
        );
    }
    
    noise3D(x, y, z) {
        // Simple 3D noise implementation
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        
        const A = this.perm[X] + Y;
        const AA = this.perm[A] + Z;
        const AB = this.perm[A + 1] + Z;
        const B = this.perm[X + 1] + Y;
        const BA = this.perm[B] + Z;
        const BB = this.perm[B + 1] + Z;
        
        return this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad(this.perm[AA], x, y, z), this.grad(this.perm[BA], x - 1, y, z)),
                this.lerp(u, this.grad(this.perm[AB], x, y - 1, z), this.grad(this.perm[BB], x - 1, y - 1, z))
            ),
            this.lerp(v,
                this.lerp(u, this.grad(this.perm[AA + 1], x, y, z - 1), this.grad(this.perm[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.perm[AB + 1], x, y - 1, z - 1), this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1))
            )
        );
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(t, a, b) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y, z = 0) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
}

// Terrain generator class
class TerrainGenerator {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.noise = new SimplexNoise(seed);
        
        // Terrain parameters
        this.params = {
            baseHeight: 32,
            heightVariation: 16,
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2.0,
            scale: 0.01,
            waterLevel: 25
        };
    }
    
    // Generate height at world coordinates
    getHeightAt(worldX, worldZ) {
        let height = 0;
        let amplitude = 1;
        let frequency = this.params.scale;
        let maxValue = 0;
        
        // Octave noise for more realistic terrain
        for (let i = 0; i < this.params.octaves; i++) {
            height += this.noise.noise2D(worldX * frequency, worldZ * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= this.params.persistence;
            frequency *= this.params.lacunarity;
        }
        
        // Normalize and scale
        height = height / maxValue;
        height = this.params.baseHeight + height * this.params.heightVariation;
        
        return Math.floor(height);
    }
    
    // Generate chunk terrain
    generateChunk(chunk) {
        const startX = chunk.x * chunk.size;
        const startY = chunk.y * chunk.size;
        const startZ = chunk.z * chunk.size;
        
        let hasBlocks = false;
        
        for (let x = 0; x < chunk.size; x++) {
            for (let z = 0; z < chunk.size; z++) {
                const worldX = startX + x;
                const worldZ = startZ + z;
                
                // Get terrain height
                const surfaceHeight = this.getHeightAt(worldX, worldZ);
                
                for (let y = 0; y < chunk.size; y++) {
                    const worldY = startY + y;
                    
                    let blockType = BlockType.AIR;
                    
                    if (worldY < surfaceHeight - 3) {
                        // Deep underground - stone
                        blockType = BlockType.STONE;
                    } else if (worldY < surfaceHeight) {
                        // Near surface - dirt
                        blockType = BlockType.DIRT;
                    } else if (worldY === surfaceHeight) {
                        // Surface block
                        if (worldY < this.params.waterLevel) {
                            blockType = BlockType.SAND;
                        } else {
                            blockType = BlockType.GRASS;
                        }
                    } else if (worldY <= this.params.waterLevel) {
                        // Water
                        blockType = BlockType.WATER;
                    }
                    
                    // Add caves using 3D noise
                    if (blockType !== BlockType.AIR && blockType !== BlockType.WATER) {
                        const caveNoise = this.noise.noise3D(
                            worldX * 0.05,
                            worldY * 0.05,
                            worldZ * 0.05
                        );
                        
                        if (caveNoise > 0.7) {
                            blockType = BlockType.AIR;
                        }
                    }
                    
                    // Set block in chunk
                    if (blockType !== BlockType.AIR) {
                        chunk.setVoxel(x, y, z, blockType);
                        hasBlocks = true;
                    }
                }
            }
        }
        
        chunk.isEmpty = !hasBlocks;
        chunk.needsUpdate = true;
        
        return chunk;
    }
    
    // Generate decorations (trees, etc.)
    generateDecorations(chunk) {
        const startX = chunk.x * chunk.size;
        const startZ = chunk.z * chunk.size;
        
        // Simple tree generation
        for (let x = 2; x < chunk.size - 2; x += 4) {
            for (let z = 2; z < chunk.size - 2; z += 4) {
                const worldX = startX + x;
                const worldZ = startZ + z;
                
                // Random chance for tree
                const treeChance = this.noise.noise2D(worldX * 0.1, worldZ * 0.1);
                if (treeChance > 0.6) {
                    const surfaceHeight = this.getHeightAt(worldX, worldZ);
                    
                    // Check if surface is grass
                    const surfaceY = surfaceHeight - chunk.y * chunk.size;
                    if (surfaceY >= 0 && surfaceY < chunk.size) {
                        const surfaceBlock = chunk.getVoxel(x, surfaceY, z);
                        if (surfaceBlock === BlockType.GRASS) {
                            this.generateTree(chunk, x, surfaceY + 1, z);
                        }
                    }
                }
            }
        }
    }
    
    // Generate a simple tree
    generateTree(chunk, x, y, z) {
        // Tree trunk
        for (let h = 0; h < 5; h++) {
            if (y + h < chunk.size) {
                chunk.setVoxel(x, y + h, z, BlockType.WOOD);
            }
        }
        
        // Tree leaves (simple cube for now)
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = 3; dy <= 6; dy++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const lx = x + dx;
                    const ly = y + dy;
                    const lz = z + dz;
                    
                    if (lx >= 0 && lx < chunk.size &&
                        ly >= 0 && ly < chunk.size &&
                        lz >= 0 && lz < chunk.size) {
                        
                        // Skip trunk positions
                        if (!(dx === 0 && dz === 0 && dy < 5)) {
                            // Random leaf density
                            const leafChance = Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 4);
                            if (leafChance < 4) {
                                chunk.setVoxel(lx, ly, lz, BlockType.LEAVES);
                            }
                        }
                    }
                }
            }
        }
    }
}

// World class that manages terrain generation
class World {
    constructor(scene) {
        this.scene = scene;
        this.terrainGenerator = new TerrainGenerator();
        this.chunkManager = new ChunkManager(scene);
        this.blockManager = new BlockManager();
        
        // Initialize chunk manager with camera
        this.chunks = this.chunkManager.chunks;
    }
    
    async generate() {
        // Generate initial chunks around origin
        const initialRadius = 2;
        for (let x = -initialRadius; x <= initialRadius; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -initialRadius; z <= initialRadius; z++) {
                    const chunk = this.chunkManager.getChunkByIndex(x, y, z);
                    this.terrainGenerator.generateChunk(chunk);
                    
                    // Add decorations to surface chunks
                    if (y === 0) {
                        this.terrainGenerator.generateDecorations(chunk);
                    }
                }
            }
        }
        
        console.log('World generated with', this.chunks.size, 'chunks');
    }
    
    update(cameraPosition, deltaTime) {
        // Update chunk manager
        this.chunkManager.update(cameraPosition, window.game.camera);
    }
    
    getBlockAt(worldX, worldY, worldZ) {
        const chunk = this.chunkManager.getChunk(worldX, worldY, worldZ);
        if (!chunk) return BlockType.AIR;
        
        const localX = Math.floor(worldX) % chunk.size;
        const localY = Math.floor(worldY) % chunk.size;
        const localZ = Math.floor(worldZ) % chunk.size;
        
        return chunk.getVoxel(localX, localY, localZ);
    }
    
    setBlockAt(worldX, worldY, worldZ, blockType) {
        const chunk = this.chunkManager.getChunk(worldX, worldY, worldZ);
        if (!chunk) return false;
        
        const localX = Math.floor(worldX) % chunk.size;
        const localY = Math.floor(worldY) % chunk.size;
        const localZ = Math.floor(worldZ) % chunk.size;
        
        const success = chunk.setVoxel(localX, localY, localZ, blockType);
        
        if (success) {
            // Update chunk mesh
            this.chunkManager.updateChunkMesh(chunk);
            
            // Update neighbor chunks if block is on edge
            if (localX === 0 || localX === chunk.size - 1 ||
                localY === 0 || localY === chunk.size - 1 ||
                localZ === 0 || localZ === chunk.size - 1) {
                
                Object.values(chunk.neighbors).forEach(neighbor => {
                    if (neighbor) {
                        neighbor.needsUpdate = true;
                    }
                });
            }
        }
        
        return success;
    }
    
    getBlockCount() {
        return this.chunkManager.getStats().totalBlocks;
    }
    
    dispose() {
        this.chunkManager.dispose();
        this.blockManager.dispose();
    }
}

// Export
window.SimplexNoise = SimplexNoise;
window.TerrainGenerator = TerrainGenerator;
window.World = World;