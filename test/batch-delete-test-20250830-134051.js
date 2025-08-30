/**
 * Batch Delete Test Simulation
 * This script simulates the batch delete scenario to reproduce the bug
 * where deleting 2 PDF files shows the second file still in the UI.
 */

// Mock implementation for testing
class MockEventBus {
    constructor() {
        this.listeners = {};
        this.log = [];
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        this.log.push({ type: 'subscribe', event, timestamp: Date.now() });
    }

    emit(event, data, options = {}) {
        this.log.push({ 
            type: 'emit', 
            event, 
            data, 
            actorId: options.actorId,
            timestamp: Date.now() 
        });
        
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                setTimeout(() => callback(data), 0);
            });
        }
    }

    getLog() {
        return this.log;
    }
}

class MockPDFManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.pdfs = [
            { id: 1, filename: 'test1.pdf', title: 'Test 1' },
            { id: 2, filename: 'test2.pdf', title: 'Test 2' },
            { id: 3, filename: 'test3.pdf', title: 'Test 3' }
        ];
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventBus.on('pdf:remove:requested', (filename) => {
            console.log(`MockPDFManager: Remove requested for ${filename}`);
            
            // Simulate server response with delay
            setTimeout(() => {
                // Simulate backend deleting the file
                this.pdfs = this.pdfs.filter(pdf => pdf.filename !== filename);
                
                // Simulate server broadcasting update
                this.eventBus.emit('websocket:message:updated', {
                    type: 'pdf_list_updated',
                    data: {
                        files: this.pdfs
                    }
                }, { actorId: 'MockBackend' });
            }, 100); // Simulate network delay
        });
    }

    getPDFs() {
        return [...this.pdfs];
    }
}

class MockUIManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.pdfs = [];
        this.setupEventListeners();
        this.renderCalls = 0;
    }

    setupEventListeners() {
        this.eventBus.on('pdf:list:updated', (pdfs) => {
            console.log(`MockUIManager: PDF list updated with ${pdfs.length} files`);
            this.pdfs = pdfs;
            this.renderCalls++;
            console.log(`MockUIManager: Render call #${this.renderCalls}`);
        });
    }

    handleBatchDelete(identifiers) {
        console.log(`MockUIManager: Batch delete for ${identifiers.length} files`);
        identifiers.forEach((identifier, index) => {
            console.log(`Sending remove request for ${identifier} (${index + 1}/${identifiers.length})`);
            this.eventBus.emit('pdf:remove:requested', identifier, { actorId: 'UIManager' });
        });
    }
}

class MockPDFTable {
    constructor(container, config) {
        this.data = [];
        this.loadDataCalls = 0;
        this.eventLog = [];
    }

    loadData(data) {
        console.log(`MockPDFTable: loadData called with ${data.length} files`);
        this.loadDataCalls++;
        this.data = [...data];
        this.eventLog.push({
            event: 'loadData',
            dataLength: data.length,
            timestamp: Date.now()
        });
        
        // Simulate async behavior
        return Promise.resolve();
    }

    getState() {
        return {
            dataLength: this.data.length,
            loadDataCalls: this.loadDataCalls,
            eventLog: this.eventLog
        };
    }
}

// Test scenarios
async function runBatchDeleteTest() {
    console.log('=== Batch Delete Test Started ===');
    
    // Create mock objects
    const eventBus = new MockEventBus();
    const pdfManager = new MockPDFManager(eventBus);
    const uiManager = new MockUIManager(eventBus);
    const pdfTable = new MockPDFTable(null, {});
    
    // Initial load
    console.log('\n1. Initial PDF list load:');
    eventBus.emit('pdf:list:updated', pdfManager.getPDFs(), { actorId: 'InitialLoad' });
    
    // Wait for initial load to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Test case 1: Delete 2 files
    console.log('\n2. Testing delete 2 files:');
    const filesToDelete = ['test1.pdf', 'test2.pdf'];
    uiManager.handleBatchDelete(filesToDelete);
    
    // Wait for operations to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check results
    console.log('\n=== Test Results ===');
    console.log('PDF Manager PDFs:', pdfManager.getPDFs().map(p => p.filename));
    console.log('UI Manager PDFs:', uiManager.pdfs.map(p => p.filename));
    console.log('PDF Table Data:', pdfTable.data.map(p => p.filename));
    console.log('PDF Table loadData calls:', pdfTable.loadDataCalls);
    console.log('UI Manager render calls:', uiManager.renderCalls);
    console.log('\nEvent Bus Log:');
    eventBus.getLog().forEach(log => {
        console.log(`  ${log.timestamp}: ${log.type} - ${log.event || 'N/A'}`, 
                   log.data || log.actorId || '');
    });
    
    // Analyze potential issues
    console.log('\n=== Issue Analysis ===');
    if (pdfManager.getPDFs().length !== uiManager.pdfs.length) {
        console.warn('ISSUE: PDFManager and UIManager have different PDF counts!');
    }
    
    if (pdfManager.getPDFs().length !== pdfTable.data.length) {
        console.warn('ISSUE: PDFManager and PDFTable have different PDF counts!');
    }
    
    if (pdfTable.loadDataCalls === 0) {
        console.warn('ISSUE: PDFTable.loadData was never called!');
    }
    
    // Test timing between events
    console.log('\n=== Event Timing Analysis ===');
    const events = eventBus.getLog();
    const removeEvents = events.filter(e => e.event === 'pdf:remove:requested');
    const updateEvents = events.filter(e => e.event === 'pdf:list:updated');
    
    removeEvents.forEach((removeEvent, index) => {
        const nextUpdate = updateEvents.find(u => u.timestamp > removeEvent.timestamp);
        if (nextUpdate) {
            const delay = nextUpdate.timestamp - removeEvent.timestamp;
            console.log(`Remove request ${index + 1} to update delay: ${delay}ms`);
        }
    });
}

// Run the test
runBatchDeleteTest().catch(console.error);

// Export test functions for use in browser
if (typeof window !== 'undefined') {
    window.runBatchDeleteTest = runBatchDeleteTest;
    window.MockEventBus = MockEventBus;
    window.MockPDFManager = MockPDFManager;
    window.MockUIManager = MockUIManager;
    window.MockPDFTable = MockPDFTable;
}