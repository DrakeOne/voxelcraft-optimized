/**
 * VoxelCraft Optimized - Desktop Controls
 * First-person controls for desktop browsers
 */

'use strict';

class DesktopControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        
        // Physics
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 100;
        this.jumpSpeed = 150;
        this.gravity = -300;
        
        // Mouse look
        this.mouseSensitivity = 0.002;
        this.pitch = 0;
        this.yaw = 0;
        this.pitchObject = new THREE.Object3D();
        this.yawObject = new THREE.Object3D();
        
        // Pointer lock
        this.isLocked = false;
        
        // Raycaster for collision
        this.raycaster = new THREE.Raycaster();
        this.downRay = new THREE.Vector3(0, -1, 0);
        
        this.setupControls();
    }
    
    init() {
        // Setup camera hierarchy for proper rotation
        this.yawObject.position.copy(this.camera.position);
        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);
        
        // Request pointer lock on click
        this.domElement.addEventListener('click', () => {
            if (!this.isLocked) {
                this.domElement.requestPointerLock();
            }
        });
        
        // Pointer lock change events
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.domElement;
        });
        
        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer lock error');
        });
    }
    
    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Mouse controls
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        // Prevent right click menu
        this.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = true;
                break;
            case 'Space':
                if (this.canJump) {
                    this.velocity.y = this.jumpSpeed;
                    this.canJump = false;
                }
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.speed = 150; // Sprint
                break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.speed = 100; // Normal speed
                break;
        }
    }
    
    onMouseMove(event) {
        if (!this.isLocked) return;
        
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
        
        // Update yaw and pitch
        this.yaw -= movementX * this.mouseSensitivity;
        this.pitch -= movementY * this.mouseSensitivity;
        
        // Clamp pitch
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        
        // Apply rotations
        this.yawObject.rotation.y = this.yaw;
        this.pitchObject.rotation.x = this.pitch;
    }
    
    onMouseDown(event) {
        if (!this.isLocked) return;
        
        switch (event.button) {
            case 0: // Left click - break block
                this.breakBlock();
                break;
            case 2: // Right click - place block
                this.placeBlock();
                break;
        }
    }
    
    onMouseUp(event) {
        // Handle mouse up events if needed
    }
    
    update(deltaTime) {
        if (!this.isLocked) return;
        
        // Apply gravity
        this.velocity.y += this.gravity * deltaTime;
        
        // Calculate movement direction
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();
        
        // Apply movement
        if (this.moveForward || this.moveBackward) {
            this.velocity.z = -this.direction.z * this.speed;
        } else {
            this.velocity.z *= 0.9; // Friction
        }
        
        if (this.moveLeft || this.moveRight) {
            this.velocity.x = this.direction.x * this.speed;
        } else {
            this.velocity.x *= 0.9; // Friction
        }
        
        // Update position
        const moveVector = new THREE.Vector3();
        moveVector.x = this.velocity.x * deltaTime;
        moveVector.y = this.velocity.y * deltaTime;
        moveVector.z = this.velocity.z * deltaTime;
        
        // Apply rotation to movement
        moveVector.applyQuaternion(this.yawObject.quaternion);
        
        // Update position
        this.yawObject.position.add(moveVector);
        
        // Simple ground collision
        if (this.yawObject.position.y < 10) {
            this.yawObject.position.y = 10;
            this.velocity.y = 0;
            this.canJump = true;
        }
        
        // Update camera world position
        this.camera.getWorldPosition(this.camera.position);
    }
    
    breakBlock() {
        // Cast ray from camera
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // Check for intersections with world
        if (window.game && window.game.world) {
            const intersects = this.raycaster.intersectObjects(
                window.game.scene.children.filter(obj => obj.type === 'Mesh')
            );
            
            if (intersects.length > 0) {
                const hit = intersects[0];
                const point = hit.point.sub(hit.face.normal.multiplyScalar(0.5));
                
                // Remove block at position
                window.game.world.setBlockAt(
                    Math.floor(point.x),
                    Math.floor(point.y),
                    Math.floor(point.z),
                    BlockType.AIR
                );
            }
        }
    }
    
    placeBlock() {
        // Cast ray from camera
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // Check for intersections with world
        if (window.game && window.game.world) {
            const intersects = this.raycaster.intersectObjects(
                window.game.scene.children.filter(obj => obj.type === 'Mesh')
            );
            
            if (intersects.length > 0) {
                const hit = intersects[0];
                const point = hit.point.add(hit.face.normal.multiplyScalar(0.5));
                
                // Place block at position
                window.game.world.setBlockAt(
                    Math.floor(point.x),
                    Math.floor(point.y),
                    Math.floor(point.z),
                    BlockType.STONE
                );
            }
        }
    }
    
    getPosition() {
        return this.yawObject.position;
    }
    
    setPosition(x, y, z) {
        this.yawObject.position.set(x, y, z);
    }
    
    dispose() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
    }
}

// Export
window.DesktopControls = DesktopControls;