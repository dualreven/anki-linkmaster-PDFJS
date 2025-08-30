/**
 * Batch Delete Hypothesis Verification Tests
 * Tests specific hypotheses about why deleting 2 PDF files shows the second file still in UI.
 */

// Test for Hypothesis 1: Race Condition in Event Processing
async function testRaceCondition() {
    console.log('\n=== Testing Race Condition Hypothesis ===');
    
    const eventBus = new MockEventBus();
    let pdfTableUpdateCount = 0;
    let lastUpdateData = null;
    
    // Simulate PDFTable that tracks updates
    class TrackingPDFTable extends MockPDFTable {
        loadData(data) {
            pdfTableUpdateCount++;
            console.log(`PDFTable update #${pdfTableUpdateCount} with ${data.length} files`);
            
            if (lastUpdateData) {
                console.log('Previous data:', lastUpdateData.map(p => p.filename));
                console.log('New data:', data.map(p => p.filename));
            }
            
            lastUpdateData = [...data];
            return super.loadData(data);
        }
    }
    
    const pdfTable = new TrackingPDFTable(null, {});
    const pdfManager = new MockPDFManager(eventBus);
    const uiManager = new MockUIManager(eventBus);
    
    // Simulate PDFTable listening to updates
    eventBus.on('pdf:list:updated', (pdfs) => {
        pdfTable.loadData(pdfs);
    });
    
    // Initial state
    eventBus.emit('pdf:list:updated', pdfManager.getPDFs(), { actorId: 'InitialLoad' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('\n--- Deleting 2 files with minimal delay ---');
    pdfTableUpdateCount = 0;
    
    // Send two delete requests with minimal delay
    uiManager.handleBatchDelete(['test1.pdf', 'test2.pdf']);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log(`\nResults:`);
    console.log(`- PDFTable received ${pdfTableUpdateCount} updates`);
    console.log(`- Expected files remaining: 1`);
    console.log(`- Actual files in table: ${pdfTable.data.length}`);
    
    if (pdfTableUpdateCount > 1) {
        console.warn('RACE CONDITION DETECTED: Multiple updates detected');
        console.log('This suggests race condition might be the cause');
    } else {
        console.log('No race condition detected');
    }
}

// Test for Hypothesis 2: Timing Issue with loadData Calls
async function testTimingIssue() {
    console.log('\n=== Testing Timing Issue Hypothesis ===');
    
    const eventBus = new MockEventBus();
    let loadDataStartTime = 0;
    let loadDataDurations = [];
    
    // Simulate slow PDFTable
    class SlowPDFTable extends MockPDFTable {
        async loadData(data) {
            const startTime = Date.now();
            if (loadDataStartTime > 0) {
                const timeSinceLastStart = startTime - loadDataStartTime;
                console.log(`Time since last loadData start: ${timeSinceLastStart}ms`);
            }
            loadDataStartTime = startTime;
            
            // Simulate slower rendering
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const duration = Date.now() - startTime;
            loadDataDurations.push(duration);
            console.log(`loadData completed in ${duration}ms`);
            
            await super.loadData(data);
        }
    }
    
    const pdfTable = new SlowPDFTable(null, {});
    const pdfManager = new MockPDFManager(eventBus);
    const uiManager = new MockUIManager(eventBus);
    
    eventBus.on('pdf:list:updated', (pdfs) => {
        pdfTable.loadData(pdfs);
    });
    
    // Initial state
    eventBus.emit('pdf:list:updated', pdfManager.getPDFs(), { actorId: 'InitialLoad' });
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('\n--- Testing with slow PDFTable ---');
    loadDataStartTime = 0;
    loadDataDurations = [];
    
    // Delete 2 files
    uiManager.handleBatchDelete(['test1.pdf', 'test2.pdf']);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`\nResults:`);
    console.log(`- loadData durations: ${loadDataDurations.join('ms, ')}ms`);
    console.log(`- Total files processed: ${pdfTable.data.length}`);
    
    if (loadDataDurations.length > 1 && loadDataDurations[0] > 100) {
        console.warn('TIMING ISSUE DETECTED: Multiple slow loadData calls');
        console.log('This suggests timing issue might be the cause');
    } else {
        console.log('No timing issue detected');
    }
}

// Test for Hypothesis 3: Event Batching Behavior
async function testEventBatching() {
    console.log('\n=== Testing Event Batching Hypothesis ===');
    
    const eventBus = new MockEventBus();
    let pdfListUpdateCount = 0;
    
    // Track PDF list updates
    eventBus.on('pdf:list:updated', (pdfs) => {
        pdfListUpdateCount++;
        console.log(`PDF list update #${pdfListUpdateCount}: ${pdfs.length} files`);
    });
    
    const pdfManager = new MockPDFManager(eventBus);
    const uiManager = new MockUIManager(eventBus);
    
    // Test with different numbers of files
    const testCases = [
        { files: 2, description: "2 files (problem case)" },
        { files: 3, description: "3 files (working case)" },
        { files: 5, description: "5 files (working case)" }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n--- Testing ${testCase.description} ---`);
        
        // Reset counters
        pdfListUpdateCount = 0;
        
        // Setup initial files
        const initialFiles = Array.from({ length: testCase.files + 2 }, (_, i) => ({
            id: i + 1,
            filename: `test${i + 1}.pdf`,
            title: `Test ${i + 1}`
        }));
        
        pdfManager.pdfs = initialFiles;
        eventBus.emit('pdf:list:updated', pdfManager.getPDFs(), { actorId: 'InitialLoad' });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Delete files
        const filesToDelete = initialFiles.slice(0, testCase.files).map(f => f.filename);
        pdfListUpdateCount = 0;
        
        uiManager.handleBatchDelete(filesToDelete);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log(`Updates received for ${testCase.description}: ${pdfListUpdateCount}`);
    }
    
    // Analyze pattern
    console.log('\n--- Batching Analysis ---');
    console.log('If 2 files show different update pattern than 3+ files, batching issue likely');
}

// Test for Hypothesis 4: PDFManager State Consistency
async function testPDFManagerState() {
    console.log('\n=== Testing PDFManager State Consistency ===');
    
    const eventBus = new MockEventBus();
    let stateHistory = [];
    
    // Track PDFManager state
    class TrackingPDFManager extends MockPDFManager {
        constructor(eventBus) {
            super(eventBus);
            this.originalHandlePDFListUpdate = this.#handlePDFListUpdate;
            this.#handlePDFListUpdate = (data, source) => {
                const beforeState = this.getPDFs().map(p => p.filename);
                this.originalHandlePDFListUpdate.call(this, data, source);
                const afterState = this.getPDFs().map(p => p.filename);
                
                stateHistory.push({
                    source,
                    before: beforeState,
                    after: afterState,
                    timestamp: Date.now()
                });
                
                console.log(`PDFManager state from ${source}:`);
                console.log(`  Before: [${beforeState.join(', ')}]`);
                console.log(`  After:  [${afterState.join(', ')}]`);
            };
        }
    }
    
    const pdfManager = new TrackingPDFManager(eventBus);
    const uiManager = new MockUIManager(eventBus);
    
    // Initial state
    eventBus.emit('pdf:list:updated', pdfManager.getPDFs(), { actorId: 'InitialLoad' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('\n--- Tracking state changes during batch delete ---');
    stateHistory = [];
    
    // Delete 2 files
    uiManager.handleBatchDelete(['test1.pdf', 'test2.pdf']);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('\n--- State History Analysis ---');
    stateHistory.forEach((state, index) => {
        console.log(`Update ${index + 1} (${state.source}):`);
        console.log(`  Files before: ${state.before.length}`);
        console.log(`  Files after: ${state.after.length}`);
    });
    
    // Check for inconsistencies
    const hasInconsistency = stateHistory.some((state, index) => {
        if (index === 0) return false;
        const previousState = stateHistory[index - 1];
        return state.after.length > previousState.after.length;
    });
    
    if (hasInconsistency) {
        console.warn('STATE INCONSISTENCY DETECTED');
        console.log('PDFManager state increased between updates');
    }
}

// Run all hypothesis tests
async function runHypothesisTests() {
    console.log('=== Batch Delete Hypothesis Verification Tests ===');
    
    await testRaceCondition();
    await testTimingIssue();
    await testEventBatching();
    await testPDFManagerState();
    
    console.log('\n=== All Hypothesis Tests Completed ===');
}

// Export for browser use
if (typeof window !== 'undefined') {
    window.testRaceCondition = testRaceCondition;
    window.testTimingIssue = testTimingIssue;
    window.testEventBatching = testEventBatching;
    window.testPDFManagerState = testPDFManagerState;
    window.runHypothesisTests = runHypothesisTests;
}

// Import Mock classes from previous test
if (typeof require !== 'undefined') {
    const { MockEventBus, MockPDFManager, MockUIManager, MockPDFTable } = require('./batch-delete-test-20250830-134051.js');
    window.MockEventBus = MockEventBus;
    window.MockPDFManager = MockPDFManager;
    window.MockUIManager = MockUIManager;
    window.MockPDFTable = MockPDFTable;
}