import EventBus from '../event/event-bus.js';

class PDFTableEvents {
    constructor(namespace) {
        this.namespace = namespace || `pdf-table:${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        this._registrations = [];
    }

    _ns(event) {
        return `${this.namespace}:${event}`;
    }

    on(event, listener, options = {}) {
        if (typeof listener !== 'function') throw new TypeError('Listener must be a function');
        const namespaced = this._ns(event);
        const unsub = EventBus.on(namespaced, listener, { subscriberId: options.subscriberId || this.namespace });
        this._registrations.push({ namespaced, listener, unsub });
        return unsub;
    }

    once(event, listener, options = {}) {
        const namespaced = this._ns(event);
        const unsub = EventBus.once(namespaced, listener, { subscriberId: options.subscriberId || this.namespace });
        this._registrations.push({ namespaced, listener, unsub });
        return unsub;
    }

    off(event, listener) {
        const namespaced = this._ns(event);
        EventBus.off(namespaced, listener);
        this._registrations = this._registrations.filter(r => {
            if (r.namespaced === namespaced && r.listener === listener) {
                try { if (typeof r.unsub === 'function') r.unsub(); } catch (e) {}
                return false;
            }
            return true;
        });
    }

    removeAllListeners(event) {
        if (event) {
            const namespaced = this._ns(event);
            this._registrations.filter(r => r.namespaced === namespaced).forEach(r => { try { if (typeof r.unsub === 'function') r.unsub(); } catch (e) {} });
            this._registrations = this._registrations.filter(r => r.namespaced !== namespaced);
        } else {
            this._registrations.forEach(r => { try { if (typeof r.unsub === 'function') r.unsub(); } catch (e) {} });
            this._registrations = [];
        }
    }

    emit(event, data, options = {}) {
        const namespaced = this._ns(event);
        EventBus.emit(namespaced, data, { actorId: options.actorId || this.namespace });
    }

    listenerCount(event) {
        const namespaced = this._ns(event);
        return this._registrations.filter(r => r.namespaced === namespaced).length;
    }

    eventNames() {
        return Array.from(new Set(this._registrations.map(r => r.namespaced)));
    }

    listeners(event) {
        const namespaced = this._ns(event);
        return this._registrations.filter(r => r.namespaced === namespaced).map(r => r.listener);
    }

    hasListeners(event) {
        return this.listenerCount(event) > 0;
    }

    setMaxListeners() { }
    getMaxListeners() { return Infinity; }

    destroy() {
        this.removeAllListeners();
    }
}

export default PDFTableEvents;

// Legacy compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFTableEvents;
} else if (typeof window !== 'undefined') {
    window.PDFTableEvents = PDFTableEvents;
}
