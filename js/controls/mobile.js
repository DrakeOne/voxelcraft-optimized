/**
 * VoxelCraft Optimized - Mobile Controls
 * Touch controls optimized for mobile devices
 */

'use strict';

class MobileControls {
    constructor(camera) {
        this.camera = camera;
        
        // Movement state
        this.moveVector = new THREE.Vector2();
        this.lookVector = new THREE.Vector2();
        
        // Physics
        this.velocity = new THREE.Vector3();
        this.speed = 50;
        this.jumpSpeed = 100;
        this.gravity = -200;
        this.canJump = false;
        
        // Camera rotation
        this.pitch = 0;
        this.yaw = 0;
        this.touchSensitivity = 0.003;
        this.pitchObject = new THREE.Object3D();
        this.yawObject = new THREE.Object3D();
        
        // Touch tracking
        this.touches = new Map();
        this.joystickTouch = null;
        this.lookTouch = null;
        
        // UI elements
        this.joystick = null;
        this.joystickKnob = null;
        this.jumpButton = null;
        this.actionButton = null;
        
        // Joystick settings
        this.joystickRadius = 60;
        this.joystickDeadzone = 10;
    }
    
    init() {
        // Setup camera hierarchy
        this.yawObject.position.copy(this.camera.position);
        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);
        
        // Get UI elements
        this.joystick = document.getElementById('joystick');
        this.joystickKnob = document.getElementById('joystickKnob');
        this.jumpButton = document.getElementById('jumpButton');
        this.actionButton = document.getElementById('actionButton');
        
        // Setup touch controls
        this.setupTouchControls();
        
        // Show mobile controls
        const mobileControls = document.getElementById('mobileControls');
        if (mobileControls) {
            mobileControls.style.display = 'block';
        }
    }
    
    setupTouchControls() {
        // Prevent default touch behaviors
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('#mobileControls') || e.target.id === 'gameCanvas') {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('#mobileControls') || e.target.id === 'gameCanvas') {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Joystick controls
        if (this.joystick) {
            this.joystick.addEventListener('touchstart', (e) => this.onJoystickStart(e), { passive: false });
            this.joystick.addEventListener('touchmove', (e) => this.onJoystickMove(e), { passive: false });
            this.joystick.addEventListener('touchend', (e) => this.onJoystickEnd(e), { passive: false });
        }
        
        // Jump button
        if (this.jumpButton) {
            this.jumpButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.canJump) {
                    this.velocity.y = this.jumpSpeed;
                    this.canJump = false;
                    this.animateButton(this.jumpButton);
                }
            }, { passive: false });
        }
        
        // Action button
        if (this.actionButton) {
            this.actionButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.placeBlock();
                this.animateButton(this.actionButton);
            }, { passive: false });
        }
        
        // Camera look controls (touch on canvas)
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('touchstart', (e) => this.onLookStart(e), { passive: false });
            canvas.addEventListener('touchmove', (e) => this.onLookMove(e), { passive: false });
            canvas.addEventListener('touchend', (e) => this.onLookEnd(e), { passive: false });
        }
    }
    
    onJoystickStart(event) {
        event.preventDefault();
        
        const touch = event.changedTouches[0];
        this.joystickTouch = touch.identifier;
        
        const rect = this.joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        this.updateJoystick(touch.clientX - centerX, touch.clientY - centerY);
    }
    
    onJoystickMove(event) {
        event.preventDefault();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (touch.identifier === this.joystickTouch) {
                const rect = this.joystick.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                this.updateJoystick(touch.clientX - centerX, touch.clientY - centerY);
                break;
            }
        }
    }
    
    onJoystickEnd(event) {
        event.preventDefault();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (touch.identifier === this.joystickTouch) {
                this.joystickTouch = null;
                this.resetJoystick();
                break;
            }
        }
    }
    
    updateJoystick(deltaX, deltaY) {
        // Calculate distance from center
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Limit to joystick radius
        if (distance > this.joystickRadius) {
            deltaX = (deltaX / distance) * this.joystickRadius;
            deltaY = (deltaY / distance) * this.joystickRadius;
        }
        
        // Update knob position
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        }
        
        // Update movement vector (apply deadzone)
        if (distance > this.joystickDeadzone) {
            this.moveVector.x = deltaX / this.joystickRadius;
            this.moveVector.y = -deltaY / this.joystickRadius; // Invert Y
        } else {
            this.moveVector.x = 0;
            this.moveVector.y = 0;
        }
    }
    
    resetJoystick() {
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(0, 0)';
        }
        this.moveVector.set(0, 0);
    }
    
    onLookStart(event) {
        // Use first touch that isn't on controls
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (!event.target.closest('#mobileControls')) {
                this.lookTouch = touch.identifier;
                this.touches.set(touch.identifier, {
                    startX: touch.clientX,
                    startY: touch.clientY,
                    currentX: touch.clientX,
                    currentY: touch.clientY
                });
                break;
            }
        }
    }
    
    onLookMove(event) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (touch.identifier === this.lookTouch) {
                const touchData = this.touches.get(touch.identifier);
                if (touchData) {
                    const deltaX = touch.clientX - touchData.currentX;
                    const deltaY = touch.clientY - touchData.currentY;
                    
                    // Update camera rotation
                    this.yaw -= deltaX * this.touchSensitivity;
                    this.pitch -= deltaY * this.touchSensitivity;
                    
                    // Clamp pitch
                    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
                    
                    // Apply rotations
                    this.yawObject.rotation.y = this.yaw;
                    this.pitchObject.rotation.x = this.pitch;
                    
                    // Update touch data
                    touchData.currentX = touch.clientX;
                    touchData.currentY = touch.clientY;
                }
                break;
            }
        }
    }
    
    onLookEnd(event) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (touch.identifier === this.lookTouch) {
                this.touches.delete(touch.identifier);
                this.lookTouch = null;
                
                // Check for tap (potential block break)
                const touchData = this.touches.get(touch.identifier);
                if (touchData) {
                    const distance = Math.sqrt(
                        Math.pow(touch.clientX - touchData.startX, 2) +
                        Math.pow(touch.clientY - touchData.startY, 2)
                    );
                    
                    if (distance < 10) { // Tap detected
                        this.breakBlock();
                    }
                }
                break;
            }
        }
    }
    
    update(deltaTime) {
        // Apply gravity
        this.velocity.y += this.gravity * deltaTime;
        
        // Apply joystick movement
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        
        forward.applyQuaternion(this.yawObject.quaternion);
        right.applyQuaternion(this.yawObject.quaternion);
        
        // Calculate movement
        const movement = new THREE.Vector3();
        movement.addScaledVector(forward, this.moveVector.y * this.speed * deltaTime);
        movement.addScaledVector(right, this.moveVector.x * this.speed * deltaTime);
        
        // Apply movement
        this.yawObject.position.add(movement);
        this.yawObject.position.y += this.velocity.y * deltaTime;
        
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
        // Cast ray from camera center
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // Check for intersections with world
        if (window.game && window.game.world) {
            const intersects = raycaster.intersectObjects(
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
                
                // Haptic feedback if available
                if (window.navigator.vibrate) {
                    window.navigator.vibrate(50);
                }
            }
        }
    }
    
    placeBlock() {
        // Cast ray from camera center
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // Check for intersections with world
        if (window.game && window.game.world) {
            const intersects = raycaster.intersectObjects(
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
                
                // Haptic feedback if available
                if (window.navigator.vibrate) {
                    window.navigator.vibrate(30);
                }
            }
        }
    }
    
    animateButton(button) {
        // Simple button press animation
        button.style.transform = 'scale(0.9)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }
    
    getPosition() {
        return this.yawObject.position;
    }
    
    setPosition(x, y, z) {
        this.yawObject.position.set(x, y, z);
    }
    
    dispose() {
        // Remove event listeners
        if (this.joystick) {
            this.joystick.removeEventListener('touchstart', this.onJoystickStart);
            this.joystick.removeEventListener('touchmove', this.onJoystickMove);
            this.joystick.removeEventListener('touchend', this.onJoystickEnd);
        }
        
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.removeEventListener('touchstart', this.onLookStart);
            canvas.removeEventListener('touchmove', this.onLookMove);
            canvas.removeEventListener('touchend', this.onLookEnd);
        }
    }
}

// Export
window.MobileControls = MobileControls;