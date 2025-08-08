/**
 * VoxelCraft Optimized - Block System
 * Defines block types and properties
 */

'use strict';

// Block types enumeration
const BlockType = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    SAND: 4,
    WATER: 5,
    WOOD: 6,
    LEAVES: 7,
    BEDROCK: 8
};

// Block properties
const BlockProperties = {
    [BlockType.AIR]: {
        name: 'Air',
        solid: false,
        transparent: true,
        color: 0x000000,
        opacity: 0
    },
    [BlockType.GRASS]: {
        name: 'Grass',
        solid: true,
        transparent: false,
        color: 0x7CFC00,
        opacity: 1,
        topColor: 0x7CFC00,
        sideColor: 0x8B7355,
        bottomColor: 0x8B4513
    },
    [BlockType.DIRT]: {
        name: 'Dirt',
        solid: true,
        transparent: false,
        color: 0x8B4513,
        opacity: 1
    },
    [BlockType.STONE]: {
        name: 'Stone',
        solid: true,
        transparent: false,
        color: 0x808080,
        opacity: 1
    },
    [BlockType.SAND]: {
        name: 'Sand',
        solid: true,
        transparent: false,
        color: 0xF4E4BC,
        opacity: 1
    },
    [BlockType.WATER]: {
        name: 'Water',
        solid: false,
        transparent: true,
        color: 0x006994,
        opacity: 0.8
    },
    [BlockType.WOOD]: {
        name: 'Wood',
        solid: true,
        transparent: false,
        color: 0x8B4513,
        opacity: 1
    },
    [BlockType.LEAVES]: {
        name: 'Leaves',
        solid: true,
        transparent: true,
        color: 0x228B22,
        opacity: 0.9
    },
    [BlockType.BEDROCK]: {
        name: 'Bedrock',
        solid: true,
        transparent: false,
        color: 0x2F4F4F,
        opacity: 1,
        unbreakable: true
    }
};

// Block manager class
class BlockManager {
    constructor() {
        this.materials = new Map();
        this.geometries = new Map();
        this.initMaterials();
        this.initGeometries();
    }
    
    initMaterials() {
        // Create optimized materials for each block type
        Object.entries(BlockProperties).forEach(([type, props]) => {
            if (type == BlockType.AIR) return;
            
            const material = new THREE.MeshLambertMaterial({
                color: props.color,
                transparent: props.transparent,
                opacity: props.opacity,
                side: props.transparent ? THREE.DoubleSide : THREE.FrontSide,
                alphaTest: props.transparent ? 0.5 : 0,
                vertexColors: false,
                flatShading: true
            });
            
            this.materials.set(parseInt(type), material);
        });
    }
    
    initGeometries() {
        // Create base cube geometry
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        
        this.geometries.set('cube', geometry);
        
        // Create optimized face geometries for culling
        this.createFaceGeometries();
    }
    
    createFaceGeometries() {
        // Create individual face geometries for optimized rendering
        const faces = {
            top: { vertices: [[0,1,0], [1,1,0], [1,1,1], [0,1,1]], normal: [0,1,0] },
            bottom: { vertices: [[0,0,0], [0,0,1], [1,0,1], [1,0,0]], normal: [0,-1,0] },
            front: { vertices: [[0,0,1], [0,1,1], [1,1,1], [1,0,1]], normal: [0,0,1] },
            back: { vertices: [[1,0,0], [1,1,0], [0,1,0], [0,0,0]], normal: [0,0,-1] },
            left: { vertices: [[0,0,0], [0,1,0], [0,1,1], [0,0,1]], normal: [-1,0,0] },
            right: { vertices: [[1,0,1], [1,1,1], [1,1,0], [1,0,0]], normal: [1,0,0] }
        };
        
        Object.entries(faces).forEach(([name, data]) => {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const normals = [];
            const uvs = [];
            
            // Create quad vertices
            data.vertices.forEach((vertex, i) => {
                vertices.push(...vertex);
                normals.push(...data.normal);
                uvs.push(
                    (i === 1 || i === 2) ? 1 : 0,
                    (i === 2 || i === 3) ? 1 : 0
                );
            });
            
            // Set attributes
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            
            // Set indices for two triangles
            geometry.setIndex([0, 1, 2, 2, 3, 0]);
            
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            
            this.geometries.set(`face_${name}`, geometry);
        });
    }
    
    getMaterial(blockType) {
        return this.materials.get(blockType) || this.materials.get(BlockType.STONE);
    }
    
    getGeometry(type = 'cube') {
        return this.geometries.get(type);
    }
    
    getProperties(blockType) {
        return BlockProperties[blockType] || BlockProperties[BlockType.AIR];
    }
    
    isSolid(blockType) {
        const props = this.getProperties(blockType);
        return props.solid;
    }
    
    isTransparent(blockType) {
        const props = this.getProperties(blockType);
        return props.transparent;
    }
    
    dispose() {
        // Dispose materials
        this.materials.forEach(material => {
            material.dispose();
        });
        this.materials.clear();
        
        // Dispose geometries
        this.geometries.forEach(geometry => {
            geometry.dispose();
        });
        this.geometries.clear();
    }
}

// Export
window.BlockType = BlockType;
window.BlockProperties = BlockProperties;
window.BlockManager = BlockManager;