/**
 * VoxelCraft Optimized - HUD (Heads-Up Display)
 * User interface elements and performance monitoring
 */

'use strict';

class HUD {
    constructor() {
        this.elements = {};
        this.updateInterval = 100; // Update every 100ms
        this.lastUpdate = 0;
        
        // Performance smoothing
        this.fpsHistory = [];
        this.maxHistorySize = 10;
    }
    
    init() {
        // Get HUD elements
        this.elements.fpsCounter = document.getElementById('fpsCounter');
        this.elements.debugInfo = document.getElementById('debugInfo');
        this.elements.chunkCount = document.getElementById('chunkCount');
        this.elements.blockCount = document.getElementById('blockCount');
        this.elements.drawCalls = document.getElementById('drawCalls');
        this.elements.memoryUsage = document.getElementById('memoryUsage');
        this.elements.versionDisplay = document.getElementById('versionDisplay');
        
        // Setup debug toggle
        this.setupDebugToggle();
        
        // Initialize displays
        this.updateVersion();
    }
    
    setupDebugToggle() {
        // Toggle debug info with F3
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                this.toggleDebug();
            }
        });
    }
    
    toggleDebug() {
        if (this.elements.debugInfo) {
            this.elements.debugInfo.classList.toggle('active');
        }
    }
    
    update(performance) {
        const now = Date.now();
        
        // Throttle updates
        if (now - this.lastUpdate < this.updateInterval) {
            return;
        }
        
        this.lastUpdate = now;
        
        // Update FPS with smoothing
        if (performance.fps !== undefined) {
            this.fpsHistory.push(performance.fps);
            if (this.fpsHistory.length > this.maxHistorySize) {
                this.fpsHistory.shift();
            }
            
            const avgFPS = Math.round(
                this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
            );
            
            if (this.elements.fpsCounter) {
                this.elements.fpsCounter.textContent = `FPS: ${avgFPS}`;
                
                // Color code FPS
                if (avgFPS >= 50) {
                    this.elements.fpsCounter.style.color = '#00ff00';
                } else if (avgFPS >= 30) {
                    this.elements.fpsCounter.style.color = '#ffff00';
                } else {
                    this.elements.fpsCounter.style.color = '#ff0000';
                }
            }
        }
        
        // Update debug info
        if (this.elements.debugInfo && this.elements.debugInfo.classList.contains('active')) {
            if (this.elements.chunkCount) {
                this.elements.chunkCount.textContent = performance.chunks || 0;
            }
            
            if (this.elements.blockCount) {
                this.elements.blockCount.textContent = this.formatNumber(performance.blocks || 0);
            }
            
            if (this.elements.drawCalls) {
                this.elements.drawCalls.textContent = performance.drawCalls || 0;
            }
            
            if (this.elements.memoryUsage) {
                this.elements.memoryUsage.textContent = performance.memory || 0;
            }
        }
    }
    
    updateVersion() {
        if (this.elements.versionDisplay && window.GameState) {
            this.elements.versionDisplay.textContent = `v${window.GameState.version}`;
        }
    }
    
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    showMessage(message, duration = 3000) {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = 'hud-message';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 16px;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        
        document.body.appendChild(messageEl);
        
        // Remove after duration
        setTimeout(() => {
            messageEl.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(messageEl);
            }, 300);
        }, duration);
    }
    
    dispose() {
        // Clean up event listeners if needed
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
    }
`;
document.head.appendChild(style);

// Export
window.HUD = HUD;