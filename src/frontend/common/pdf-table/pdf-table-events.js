/**
 * PDF Table Events - Event Management System
 * @module PDFTableEvents
 */

class PDFTableEvents {
    /**
     * Create a new PDFTableEvents instance
     */
    constructor() {
        this.events = new Map();
        this.onceEvents = new Set();
        this.maxListeners = 100;
        this.warnings = true;
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     * @param {Object} options - Event options
     */
    on(event, listener, options = {}) {
        if (typeof listener !== 'function') {
            throw new TypeError('Listener must be a function');
        }
        
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        const listeners = this.events.get(event);
        
        // Check max listeners
        if (this.maxListeners && listeners.size >= this.maxListeners) {
            if (this.warnings) {
                console.warn(`Max listeners (${this.maxListeners}) exceeded for event: ${event}`);
            }
            return;
        }
        
        // Add listener with options
        const listenerWrapper = {
            fn: listener,
            once: options.once || false,
            context: options.context || null
        };
        
        listeners.add(listenerWrapper);
        
        // Track once events
        if (listenerWrapper.once) {
            this.onceEvents.add(event);
        }
    }

    /**
     * Add one-time event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     * @param {Object} options - Event options
     */
    once(event, listener, options = {}) {
        this.on(event, listener, { ...options, once: true });
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     */
    off(event, listener) {
        if (!this.events.has(event)) return;
        
        const listeners = this.events.get(event);
        
        for (const listenerWrapper of listeners) {
            if (listenerWrapper.fn === listener) {
                listeners.delete(listenerWrapper);
                break;
            }
        }
        
        // Clean up empty event sets
        if (listeners.size === 0) {
            this.events.delete(event);
            this.onceEvents.delete(event);
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
            this.onceEvents.delete(event);
        } else {
            this.events.clear();
            this.onceEvents.clear();
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {...*} args - Event arguments
     */
    emit(event, ...args) {
        if (!this.events.has(event)) return false;
        
        const listeners = this.events.get(event);
        const listenersArray = Array.from(listeners);
        
        // Execute listeners
        for (const listenerWrapper of listenersArray) {
            try {
                // Call listener with context
                if (listenerWrapper.context) {
                    listenerWrapper.fn.call(listenerWrapper.context, ...args);
                } else {
                    listenerWrapper.fn(...args);
                }
                
                // Remove once listeners
                if (listenerWrapper.once) {
                    listeners.delete(listenerWrapper);
                }
            } catch (error) {
                console.error(`Error in event listener for '${event}':`, error);
            }
        }
        
        // Clean up empty event sets
        if (listeners.size === 0) {
            this.events.delete(event);
            this.onceEvents.delete(event);
        }
        
        return true;
    }

    /**
     * Get listener count for event
     * @param {string} event - Event name
     * @returns {number} Listener count
     */
    listenerCount(event) {
        if (!this.events.has(event)) return 0;
        return this.events.get(event).size;
    }

    /**
     * Get all event names
     * @returns {Array} Event names
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * Get listeners for event
     * @param {string} event - Event name
     * @returns {Array} Event listeners
     */
    listeners(event) {
        if (!this.events.has(event)) return [];
        return Array.from(this.events.get(event)).map(wrapper => wrapper.fn);
    }

    /**
     * Check if event has listeners
     * @param {string} event - Event name
     * @returns {boolean} Has listeners
     */
    hasListeners(event) {
        return this.events.has(event) && this.events.get(event).size > 0;
    }

    /**
     * Set max listeners
     * @param {number} max - Maximum listeners
     */
    setMaxListeners(max) {
        this.maxListeners = max;
    }

    /**
     * Get max listeners
     * @returns {number} Maximum listeners
     */
    getMaxListeners() {
        return this.maxListeners;
    }

    /**
     * Enable/disable warnings
     * @param {boolean} enabled - Enable warnings
     */
    setWarnings(enabled) {
        this.warnings = enabled;
    }

    /**
     * Get event statistics
     * @returns {Object} Event statistics
     */
    getStats() {
        const stats = {
            totalEvents: this.events.size,
            totalListeners: 0,
            onceEvents: this.onceEvents.size,
            eventDetails: {}
        };
        
        for (const [event, listeners] of this.events) {
            const eventStats = {
                listenerCount: listeners.size,
                onceListeners: Array.from(listeners).filter(l => l.once).length
            };
            stats.eventDetails[event] = eventStats;
            stats.totalListeners += eventStats.listenerCount;
        }
        
        return stats;
    }

    /**
     * Wait for event
     * @param {string} event - Event name
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Promise that resolves when event is emitted
     */
    waitFor(event, timeout = 0) {
        return new Promise((resolve, reject) => {
            const timer = timeout ? setTimeout(() => {
                this.off(event, listener);
                reject(new Error(`Event '${event}' timeout after ${timeout}ms`));
            }, timeout) : null;
            
            const listener = (...args) => {
                if (timer) clearTimeout(timer);
                this.off(event, listener);
                resolve(args);
            };
            
            this.on(event, listener);
        });
    }

    /**
     * Emit event asynchronously
     * @param {string} event - Event name
     * @param {...*} args - Event arguments
     * @returns {Promise} Promise that resolves when event is emitted
     */
    async emitAsync(event, ...args) {
        return new Promise((resolve) => {
            setImmediate(() => {
                this.emit(event, ...args);
                resolve();
            });
        });
    }

    /**
     * Add event listener with priority
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     * @param {number} priority - Priority (higher = executed first)
     * @param {Object} options - Event options
     */
    prioritize(event, listener, priority = 0, options = {}) {
        if (typeof listener !== 'function') {
            throw new TypeError('Listener must be a function');
        }
        
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        const listeners = this.events.get(event);
        
        // Create priority listener wrapper
        const listenerWrapper = {
            fn: listener,
            once: options.once || false,
            context: options.context || null,
            priority: priority
        };
        
        // Insert listener in priority order
        const listenersArray = Array.from(listeners);
        listenersArray.push(listenerWrapper);
        listenersArray.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        // Update listeners set
        listeners.clear();
        listenersArray.forEach(l => listeners.add(l));
        
        // Track once events
        if (listenerWrapper.once) {
            this.onceEvents.add(event);
        }
    }

    /**
     * Add event listener that runs before others
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     * @param {Object} options - Event options
     */
    prependListener(event, listener, options = {}) {
        this.prioritize(event, listener, 100, options);
    }

    /**
     * Add event listener that runs after others
     * @param {string} event - Event name
     * @param {Function} listener - Event listener
     * @param {Object} options - Event options
     */
    appendListener(event, listener, options = {}) {
        this.prioritize(event, listener, -100, options);
    }

    /**
     * Destroy event emitter
     */
    destroy() {
        this.events.clear();
        this.onceEvents.clear();
    }
}

// Export for use in other modules
// ES6 Module Export
export default PDFTableEvents;

// Legacy export for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableEvents;
} else if (typeof window !== 'undefined') {
    window.PDFTableEvents = PDFTableEvents;
}