/**
 * VoxelCraft Optimized - Performance Optimization Module
 * Handles all performance optimizations including object pooling, 
 * greedy meshing, and memory management
 */

'use strict';

// Object Pool for memory optimization
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.active = new Set();
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    acquire() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        this.active.add(obj);
        return obj;
    }
    
    release(obj) {
        if (this.active.has(obj)) {
            this.resetFn(obj);
            this.active.delete(obj);
            this.pool.push(obj);
        }
    }
    
    releaseAll() {
        this.active.forEach(obj => {
            this.resetFn(obj);
            this.pool.push(obj);
        });
        this.active.clear();
    }
    
    getStats() {
        return {
            pooled: this.pool.length,
            active: this.active.size,
            total: this.pool.length + this.active.size
        };
    }
}

// Greedy Meshing Algorithm for voxel optimization
class GreedyMesher {
    constructor() {
        this.dims = [32, 32, 32];
        this.mask = new Int32Array(this.dims[0] * this.dims[1]);
        this.tempVoxels = null;
    }
    
    mesh(voxels, dims) {
        const vertices = [];
        const indices = [];
        const normals = [];
        const uvs = [];
        let indexOffset = 0;
        
        // Process each axis
        for (let d = 0; d < 3; d++) {
            const u = (d + 1) % 3;
            const v = (d + 2) % 3;
            
            const x = [0, 0, 0];
            const q = [0, 0, 0];
            const du = [0, 0, 0];
            const dv = [0, 0, 0];
            
            q[d] = 1;
            
            const mask = new Int32Array(dims[u] * dims[v]);
            
            for (x[d] = -1; x[d] < dims[d];) {
                // Compute mask
                let n = 0;
                for (x[v] = 0; x[v] < dims[v]; x[v]++) {
                    for (x[u] = 0; x[u] < dims[u]; x[u]++) {
                        const a = x[d] >= 0 ? this.getVoxel(voxels, x, dims) : 0;
                        const b = x[d] < dims[d] - 1 ? this.getVoxel(voxels, [x[0] + q[0], x[1] + q[1], x[2] + q[2]], dims) : 0;
                        
                        if (a !== b) {
                            mask[n] = a ? a : -b;
                        } else {
                            mask[n] = 0;
                        }
                        n++;
                    }
                }
                
                x[d]++;
                
                // Generate mesh from mask
                n = 0;
                for (let j = 0; j < dims[v]; j++) {
                    for (let i = 0; i < dims[u];) {
                        if (mask[n] !== 0) {
                            // Compute width
                            let w = 1;
                            while (i + w < dims[u] && mask[n + w] === mask[n]) {
                                w++;
                            }
                            
                            // Compute height
                            let h = 1;
                            let done = false;
                            
                            for (; h < dims[v] - j; h++) {
                                for (let k = 0; k < w; k++) {
                                    if (mask[n + k + h * dims[u]] !== mask[n]) {
                                        done = true;
                                        break;
                                    }
                                }
                                if (done) break;
                            }
                            
                            // Add quad
                            x[u] = i;
                            x[v] = j;
                            
                            du[u] = w;
                            dv[v] = h;
                            
                            const quad = this.createQuad(x, du, dv, mask[n] > 0, d);
                            vertices.push(...quad.vertices);
                            normals.push(...quad.normals);
                            uvs.push(...quad.uvs);
                            
                            // Add indices
                            indices.push(
                                indexOffset, indexOffset + 1, indexOffset + 2,
                                indexOffset + 2, indexOffset + 3, indexOffset
                            );
                            indexOffset += 4;
                            
                            // Clear mask
                            for (let l = 0; l < h; l++) {
                                for (let k = 0; k < w; k++) {
                                    mask[n + k + l * dims[u]] = 0;
                                }
                            }
                            
                            i += w;
                            n += w;
                        } else {
                            i++;
                            n++;
                        }
                    }
                }
            }
        }
        
        return { vertices, indices, normals, uvs };
    }
    
    getVoxel(voxels, pos, dims) {
        const index = pos[0] + pos[1] * dims[0] + pos[2] * dims[0] * dims[1];
        return voxels[index] || 0;
    }
    
    createQuad(pos, du, dv, front, axis) {
        const vertices = [];
        const normals = [];
        const uvs = [];
        
        const normal = [0, 0, 0];
        normal[axis] = front ? 1 : -1;
        
        // Create 4 vertices for the quad
        for (let i = 0; i < 4; i++) {
            const vertex = [
                pos[0] + (i === 1 || i === 2 ? du[0] : 0) + (i === 2 || i === 3 ? dv[0] : 0),
                pos[1] + (i === 1 || i === 2 ? du[1] : 0) + (i === 2 || i === 3 ? dv[1] : 0),
                pos[2] + (i === 1 || i === 2 ? du[2] : 0) + (i === 2 || i === 3 ? dv[2] : 0)
            ];
            
            vertices.push(...vertex);
            normals.push(...normal);
            uvs.push((i === 1 || i === 2) ? 1 : 0, (i === 2 || i === 3) ? 1 : 0);
        }
        
        return { vertices, normals, uvs };
    }
}

// Frustum Culling for chunk optimization
class FrustumCuller {
    constructor(camera) {
        this.camera = camera;
        this.frustum = new THREE.Frustum();
        this.matrix = new THREE.Matrix4();
    }
    
    update() {
        this.matrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.matrix);
    }
    
    isVisible(boundingBox) {
        return this.frustum.intersectsBox(boundingBox);
    }
    
    isSphereVisible(sphere) {
        return this.frustum.intersectsSphere(sphere);
    }
}

// LOD (Level of Detail) System
class LODSystem {
    constructor() {
        this.levels = [
            { distance: 0, detail: 1.0 },    // Full detail
            { distance: 32, detail: 0.5 },   // Half detail
            { distance: 64, detail: 0.25 },  // Quarter detail
            { distance: 128, detail: 0.1 }   // Minimal detail
        ];
    }
    
    getDetailLevel(distance) {
        for (let i = this.levels.length - 1; i >= 0; i--) {
            if (distance >= this.levels[i].distance) {
                return this.levels[i].detail;
            }
        }
        return this.levels[0].detail;
    }
    
    shouldRender(distance, maxDistance) {
        return distance <= maxDistance;
    }
}

// Occlusion Culling System
class OcclusionCuller {
    constructor() {
        this.occlusionMap = new Map();
        this.raycast = new THREE.Raycaster();
    }
    
    updateOcclusion(camera, chunks) {
        this.occlusionMap.clear();
        
        // Simple occlusion: check if chunks are behind others
        chunks.forEach(chunk => {
            if (chunk.isEmpty) {
                this.occlusionMap.set(chunk.id, false);
                return;
            }
            
            // Calculate if chunk is occluded
            const isOccluded = this.isChunkOccluded(camera, chunk, chunks);
            this.occlusionMap.set(chunk.id, !isOccluded);
        });
    }
    
    isChunkOccluded(camera, targetChunk, allChunks) {
        // Simplified occlusion check
        const direction = new THREE.Vector3();
        direction.subVectors(targetChunk.center, camera.position).normalize();
        
        this.raycast.set(camera.position, direction);
        
        // Check if any chunk blocks the view
        for (const chunk of allChunks) {
            if (chunk === targetChunk || chunk.isEmpty) continue;
            
            const intersects = this.raycast.intersectBox(chunk.boundingBox, new THREE.Vector3());
            if (intersects) {
                const distToIntersect = camera.position.distanceTo(intersects);
                const distToTarget = camera.position.distanceTo(targetChunk.center);
                
                if (distToIntersect < distToTarget) {
                    return true; // Occluded
                }
            }
        }
        
        return false;
    }
    
    isVisible(chunkId) {
        return this.occlusionMap.get(chunkId) !== false;
    }
}

// Memory Manager for garbage collection optimization
class MemoryManager {
    constructor() {
        this.pools = new Map();
        this.gcThreshold = 100 * 1024 * 1024; // 100MB
        this.lastGC = Date.now();
        this.gcInterval = 30000; // 30 seconds
    }
    
    createPool(name, createFn, resetFn, size = 10) {
        const pool = new ObjectPool(createFn, resetFn, size);
        this.pools.set(name, pool);
        return pool;
    }
    
    getPool(name) {
        return this.pools.get(name);
    }
    
    checkMemory() {
        if (!window.performance || !window.performance.memory) return;
        
        const now = Date.now();
        const memory = window.performance.memory;
        
        // Force GC if memory usage is high or enough time has passed
        if (memory.usedJSHeapSize > this.gcThreshold || 
            now - this.lastGC > this.gcInterval) {
            this.forceGarbageCollection();
            this.lastGC = now;
        }
    }
    
    forceGarbageCollection() {
        // Release all pooled objects temporarily
        this.pools.forEach(pool => {
            const stats = pool.getStats();
            if (stats.pooled > stats.active * 2) {
                // Too many pooled objects, reduce pool size
                const excess = Math.floor((stats.pooled - stats.active) / 2);
                for (let i = 0; i < excess; i++) {
                    pool.pool.pop();
                }
            }
        });
        
        // Suggest GC to browser (not guaranteed)
        if (window.gc) {
            window.gc();
        }
    }
    
    getMemoryStats() {
        if (!window.performance || !window.performance.memory) {
            return { used: 0, total: 0, percentage: 0 };
        }
        
        const memory = window.performance.memory;
        return {
            used: Math.round(memory.usedJSHeapSize / 1048576),
            total: Math.round(memory.jsHeapSizeLimit / 1048576),
            percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
        };
    }
}

// Batch Renderer for instanced rendering
class BatchRenderer {
    constructor(maxInstances = 10000) {
        this.maxInstances = maxInstances;
        this.instancedMeshes = new Map();
        this.matrices = new Float32Array(maxInstances * 16);
        this.colors = new Float32Array(maxInstances * 3);
    }
    
    createInstancedMesh(geometry, material, count) {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false; // We handle culling ourselves
        
        return mesh;
    }
    
    updateInstances(mesh, transforms) {
        const matrix = new THREE.Matrix4();
        
        for (let i = 0; i < transforms.length && i < mesh.count; i++) {
            const transform = transforms[i];
            matrix.compose(transform.position, transform.quaternion, transform.scale);
            mesh.setMatrixAt(i, matrix);
        }
        
        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = transforms.length;
    }
    
    setColorAt(mesh, index, color) {
        mesh.setColorAt(index, color);
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }
    }
}

// Export optimization utilities
const OptimizationUtils = {
    ObjectPool,
    GreedyMesher,
    FrustumCuller,
    LODSystem,
    OcclusionCuller,
    MemoryManager,
    BatchRenderer,
    
    // Helper functions
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
};

// Make available globally
window.OptimizationUtils = OptimizationUtils;