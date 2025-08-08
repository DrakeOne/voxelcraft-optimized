/**
 * VoxelCraft Optimized - Chunk System
 * Manages voxel chunks with optimized rendering and memory usage
 */

'use strict';

// Chunk class for managing voxel data
class Chunk {
    constructor(x, y, z, size = 16) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.size = size;
        this.id = `${x}_${y}_${z}`;
        
        // Voxel data - using Uint8Array for memory efficiency
        this.voxels = new Uint8Array(size * size * size);
        
        // Mesh data
        this.mesh = null;
        this.geometry = null;
        this.needsUpdate = true;
        this.isEmpty = true;
        
        // Bounding box for culling
        this.boundingBox = new THREE.Box3(
            new THREE.Vector3(x * size, y * size, z * size),
            new THREE.Vector3((x + 1) * size, (y + 1) * size, (z + 1) * size)
        );
        
        this.center = new THREE.Vector3();
        this.boundingBox.getCenter(this.center);
        
        // Neighbor references
        this.neighbors = {
            left: null,
            right: null,
            top: null,
            bottom: null,
            front: null,
            back: null
        };
        
        // LOD level
        this.lodLevel = 0;
        this.distance = Infinity;
    }
    
    // Get voxel at local coordinates
    getVoxel(x, y, z) {
        if (x < 0 || x >= this.size || 
            y < 0 || y >= this.size || 
            z < 0 || z >= this.size) {
            return 0;
        }
        
        const index = x + y * this.size + z * this.size * this.size;
        return this.voxels[index];
    }
    
    // Set voxel at local coordinates
    setVoxel(x, y, z, type) {
        if (x < 0 || x >= this.size || 
            y < 0 || y >= this.size || 
            z < 0 || z >= this.size) {
            return false;
        }
        
        const index = x + y * this.size + z * this.size * this.size;
        this.voxels[index] = type;
        this.needsUpdate = true;
        
        if (type !== 0) {
            this.isEmpty = false;
        }
        
        return true;
    }
    
    // Check if face should be rendered (not facing another solid block)
    shouldRenderFace(x, y, z, face) {
        let neighborX = x, neighborY = y, neighborZ = z;
        
        switch(face) {
            case 'left': neighborX--; break;
            case 'right': neighborX++; break;
            case 'bottom': neighborY--; break;
            case 'top': neighborY++; break;
            case 'back': neighborZ--; break;
            case 'front': neighborZ++; break;
        }
        
        // Check if neighbor is outside chunk
        if (neighborX < 0 || neighborX >= this.size ||
            neighborY < 0 || neighborY >= this.size ||
            neighborZ < 0 || neighborZ >= this.size) {
            
            // Check neighbor chunk
            const neighborChunk = this.getNeighborChunk(face);
            if (neighborChunk) {
                // Convert to neighbor chunk's local coordinates
                const localX = (neighborX + this.size) % this.size;
                const localY = (neighborY + this.size) % this.size;
                const localZ = (neighborZ + this.size) % this.size;
                
                return neighborChunk.getVoxel(localX, localY, localZ) === 0;
            }
            return true; // Render if no neighbor chunk
        }
        
        // Check within same chunk
        return this.getVoxel(neighborX, neighborY, neighborZ) === 0;
    }
    
    getNeighborChunk(face) {
        return this.neighbors[face];
    }
    
    // Generate simple mesh without greedy meshing for now
    generateMesh() {
        if (this.isEmpty) {
            if (this.mesh) {
                this.mesh.geometry.dispose();
                this.mesh = null;
            }
            return null;
        }
        
        const vertices = [];
        const normals = [];
        const uvs = [];
        const colors = [];
        
        // Simple block-by-block rendering
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const voxel = this.getVoxel(x, y, z);
                    if (voxel === 0) continue; // Skip air blocks
                    
                    // Get block color based on type
                    const blockColor = this.getBlockColor(voxel);
                    
                    // Check each face
                    const faces = [
                        { dir: 'left', normal: [-1, 0, 0], vertices: [[0,0,0], [0,1,0], [0,1,1], [0,0,1]] },
                        { dir: 'right', normal: [1, 0, 0], vertices: [[1,0,1], [1,1,1], [1,1,0], [1,0,0]] },
                        { dir: 'bottom', normal: [0, -1, 0], vertices: [[0,0,0], [0,0,1], [1,0,1], [1,0,0]] },
                        { dir: 'top', normal: [0, 1, 0], vertices: [[0,1,0], [1,1,0], [1,1,1], [0,1,1]] },
                        { dir: 'back', normal: [0, 0, -1], vertices: [[1,0,0], [1,1,0], [0,1,0], [0,0,0]] },
                        { dir: 'front', normal: [0, 0, 1], vertices: [[0,0,1], [0,1,1], [1,1,1], [1,0,1]] }
                    ];
                    
                    for (const face of faces) {
                        if (this.shouldRenderFace(x, y, z, face.dir)) {
                            // Add vertices for this face
                            const baseIndex = vertices.length / 3;
                            
                            for (const vertex of face.vertices) {
                                vertices.push(x + vertex[0], y + vertex[1], z + vertex[2]);
                                normals.push(...face.normal);
                                colors.push(blockColor.r, blockColor.g, blockColor.b);
                            }
                            
                            // Add UVs
                            uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                        }
                    }
                }
            }
        }
        
        if (vertices.length === 0) {
            this.isEmpty = true;
            return null;
        }
        
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        // Create indices for quads
        const indices = [];
        const numQuads = vertices.length / 12; // 4 vertices per quad, 3 components per vertex
        for (let i = 0; i < numQuads; i++) {
            const base = i * 4;
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        geometry.setIndex(indices);
        
        // Compute bounding sphere for frustum culling
        geometry.computeBoundingSphere();
        
        // Create or update mesh
        if (!this.mesh) {
            const material = this.createMaterial();
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.position.set(
                this.x * this.size,
                this.y * this.size,
                this.z * this.size
            );
            this.mesh.castShadow = false;
            this.mesh.receiveShadow = false;
            this.mesh.matrixAutoUpdate = false;
            this.mesh.updateMatrix();
        } else {
            // Dispose old geometry
            this.mesh.geometry.dispose();
            this.mesh.geometry = geometry;
        }
        
        this.geometry = geometry;
        this.needsUpdate = false;
        
        return this.mesh;
    }
    
    // Get block color based on type
    getBlockColor(type) {
        const colors = {
            1: { r: 0.48, g: 0.99, b: 0 },      // GRASS - bright green
            2: { r: 0.55, g: 0.27, b: 0.07 },   // DIRT - brown
            3: { r: 0.5, g: 0.5, b: 0.5 },      // STONE - gray
            4: { r: 0.96, g: 0.89, b: 0.74 },   // SAND - light yellow
            5: { r: 0, g: 0.41, b: 0.58 },      // WATER - blue
            6: { r: 0.55, g: 0.27, b: 0.07 },   // WOOD - brown
            7: { r: 0.13, g: 0.55, b: 0.13 },   // LEAVES - dark green
            8: { r: 0.18, g: 0.31, b: 0.31 }    // BEDROCK - dark gray
        };
        
        return colors[type] || { r: 1, g: 0, b: 1 }; // Default magenta for unknown
    }
    
    // Create optimized material
    createMaterial() {
        return new THREE.MeshLambertMaterial({
            vertexColors: true,
            flatShading: true,
            side: THREE.FrontSide
        });
    }
    
    // Update LOD based on distance
    updateLOD(cameraPosition) {
        this.distance = this.center.distanceTo(cameraPosition);
        
        // Simple LOD system
        const newLodLevel = this.distance > 100 ? 2 : (this.distance > 50 ? 1 : 0);
        
        if (newLodLevel !== this.lodLevel) {
            this.lodLevel = newLodLevel;
            this.needsUpdate = true;
        }
    }
    
    // Dispose of chunk resources
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (this.mesh.material.dispose) {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }
        
        this.voxels = null;
        this.neighbors = null;
    }
}

// Chunk Manager for handling multiple chunks
class ChunkManager {
    constructor(scene, chunkSize = 16, renderDistance = 4) {
        this.scene = scene;
        this.chunkSize = chunkSize;
        this.renderDistance = renderDistance;
        this.chunks = new Map();
        this.activeChunks = new Set();
        
        // Simple pool for chunks
        this.chunkPool = [];
        
        // Optimization systems
        this.frustumCuller = null;
        
        // Worker for async chunk generation
        this.generationQueue = [];
        this.isGenerating = false;
    }
    
    // Initialize frustum culler with camera
    initFrustumCuller(camera) {
        if (typeof OptimizationUtils !== 'undefined' && OptimizationUtils.FrustumCuller) {
            this.frustumCuller = new OptimizationUtils.FrustumCuller(camera);
        }
    }
    
    // Get or create chunk at world coordinates
    getChunk(worldX, worldY, worldZ) {
        const chunkX = Math.floor(worldX / this.chunkSize);
        const chunkY = Math.floor(worldY / this.chunkSize);
        const chunkZ = Math.floor(worldZ / this.chunkSize);
        
        return this.getChunkByIndex(chunkX, chunkY, chunkZ);
    }
    
    // Get or create chunk by chunk index
    getChunkByIndex(x, y, z) {
        const id = `${x}_${y}_${z}`;
        
        if (!this.chunks.has(id)) {
            // Create new chunk
            const chunk = new Chunk(x, y, z, this.chunkSize);
            
            this.chunks.set(id, chunk);
            this.linkNeighbors(chunk);
            
            // Queue for generation
            this.generationQueue.push(chunk);
        }
        
        return this.chunks.get(id);
    }
    
    // Link chunk with its neighbors
    linkNeighbors(chunk) {
        chunk.neighbors.left = this.chunks.get(`${chunk.x - 1}_${chunk.y}_${chunk.z}`);
        chunk.neighbors.right = this.chunks.get(`${chunk.x + 1}_${chunk.y}_${chunk.z}`);
        chunk.neighbors.bottom = this.chunks.get(`${chunk.x}_${chunk.y - 1}_${chunk.z}`);
        chunk.neighbors.top = this.chunks.get(`${chunk.x}_${chunk.y + 1}_${chunk.z}`);
        chunk.neighbors.back = this.chunks.get(`${chunk.x}_${chunk.y}_${chunk.z - 1}`);
        chunk.neighbors.front = this.chunks.get(`${chunk.x}_${chunk.y}_${chunk.z + 1}`);
        
        // Update neighbors to link back
        Object.entries(chunk.neighbors).forEach(([face, neighbor]) => {
            if (neighbor) {
                const oppositeFace = this.getOppositeFace(face);
                neighbor.neighbors[oppositeFace] = chunk;
            }
        });
    }
    
    getOppositeFace(face) {
        const opposites = {
            left: 'right',
            right: 'left',
            top: 'bottom',
            bottom: 'top',
            front: 'back',
            back: 'front'
        };
        return opposites[face];
    }
    
    // Update chunks based on camera position
    update(cameraPosition, camera) {
        // Update frustum culler
        if (this.frustumCuller) {
            this.frustumCuller.update();
        }
        
        // Process generation queue
        this.processGenerationQueue();
        
        // Determine which chunks should be active
        const playerChunkX = Math.floor(cameraPosition.x / this.chunkSize);
        const playerChunkY = Math.floor(cameraPosition.y / this.chunkSize);
        const playerChunkZ = Math.floor(cameraPosition.z / this.chunkSize);
        
        const newActiveChunks = new Set();
        
        // Load chunks within render distance
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let y = -2; y <= 2; y++) { // Limit vertical chunks
                for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                    const distance = Math.sqrt(x * x + y * y + z * z);
                    if (distance <= this.renderDistance) {
                        const chunk = this.getChunkByIndex(
                            playerChunkX + x,
                            playerChunkY + y,
                            playerChunkZ + z
                        );
                        
                        if (chunk) {
                            newActiveChunks.add(chunk.id);
                            
                            // Update LOD
                            chunk.updateLOD(cameraPosition);
                            
                            // Update mesh if needed
                            if (chunk.needsUpdate) {
                                this.updateChunkMesh(chunk);
                            }
                            
                            // Visibility culling
                            if (chunk.mesh) {
                                chunk.mesh.visible = true; // Always visible for now
                            }
                        }
                    }
                }
            }
        }
        
        // Unload chunks that are too far
        this.activeChunks.forEach(chunkId => {
            if (!newActiveChunks.has(chunkId)) {
                this.unloadChunk(chunkId);
            }
        });
        
        this.activeChunks = newActiveChunks;
    }
    
    // Update chunk mesh
    updateChunkMesh(chunk) {
        const oldMesh = chunk.mesh;
        const newMesh = chunk.generateMesh();
        
        if (oldMesh && oldMesh !== newMesh) {
            this.scene.remove(oldMesh);
            oldMesh.geometry.dispose();
            if (oldMesh.material.dispose) {
                oldMesh.material.dispose();
            }
        }
        
        if (newMesh && newMesh !== oldMesh) {
            this.scene.add(newMesh);
        }
    }
    
    // Unload chunk
    unloadChunk(chunkId) {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) return;
        
        if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
        }
        
        chunk.dispose();
        this.chunks.delete(chunkId);
    }
    
    // Process chunk generation queue
    processGenerationQueue() {
        if (this.isGenerating || this.generationQueue.length === 0) return;
        
        this.isGenerating = true;
        
        // Process one chunk per frame to avoid blocking
        const chunk = this.generationQueue.shift();
        if (chunk) {
            // Generate terrain for this chunk (will be implemented in terrain.js)
            if (window.TerrainGenerator) {
                window.TerrainGenerator.generateChunk(chunk);
            }
            
            this.updateChunkMesh(chunk);
        }
        
        this.isGenerating = false;
    }
    
    // Get statistics
    getStats() {
        let totalBlocks = 0;
        let renderedChunks = 0;
        
        this.chunks.forEach(chunk => {
            if (!chunk.isEmpty) {
                totalBlocks += chunk.voxels.filter(v => v !== 0).length;
                if (chunk.mesh && chunk.mesh.visible) {
                    renderedChunks++;
                }
            }
        });
        
        return {
            totalChunks: this.chunks.size,
            activeChunks: this.activeChunks.size,
            renderedChunks: renderedChunks,
            totalBlocks: totalBlocks,
            queuedChunks: this.generationQueue.length
        };
    }
    
    // Dispose all chunks
    dispose() {
        this.chunks.forEach(chunk => {
            if (chunk.mesh) {
                this.scene.remove(chunk.mesh);
            }
            chunk.dispose();
        });
        
        this.chunks.clear();
        this.activeChunks.clear();
        this.generationQueue = [];
    }
}

// Export for use in other modules
window.Chunk = Chunk;
window.ChunkManager = ChunkManager;