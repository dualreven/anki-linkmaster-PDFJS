/**
 * Batch Delete Diagnostic Logger
 * This logger captures detailed information about the batch delete process
 * to help identify issues with UI updates when deleting 2 PDF files.
 */

import Logger from "../src/frontend/common/utils/logger.js";

class BatchDeleteDiagnostic {
    constructor() {
        this.baseLogger = new Logger("BatchDeleteDiagnostic");
        this.logs = [];
        this.timestamp = new Date().toISOString();
    }

    log(message, data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        this.logs.push(logEntry);
        this.baseLogger.info(`[BATCH_DELETE_DIAG] ${message}`, data);
        console.log(`[BATCH_DELETE_DIAG] ${message}`, data);
    }

    logBatchDeleteStart(selectedFiles) {
        this.log("BATCH_DELETE_START", {
            selectedCount: selectedFiles.length,
            selectedFiles: selectedFiles.map(f => ({
                filename: f.filename,
                id: f.id,
                checkboxData: f.dataset
            }))
        });
    }

    logRemoveRequestSent(identifier, index) {
        this.log(`REMOVE_REQUEST_SENT[${index}]`, {
            identifier,
            timestamp: Date.now()
        });
    }

    logPDFListUpdateReceived(data, source) {
        this.log("PDF_LIST_UPDATE_RECEIVED", {
            source,
            fileCount: data?.data?.files?.length || 0,
            files: data?.data?.files?.map(f => ({
                id: f.id,
                filename: f.filename
            })) || []
        });
    }

    logPDFListUpdatedEvent(pdfs) {
        this.log("PDF_LIST_UPDATED_EVENT", {
            pdfCount: pdfs.length,
            pdfs: pdfs.map(p => ({
                id: p.id,
                filename: p.filename
            }))
        });
    }

    logTableLoadDataCall(data) {
        this.log("TABLE_LOAD_DATA_CALL", {
            dataType: Array.isArray(data) ? "array" : typeof data,
            dataLength: Array.isArray(data) ? data.length : undefined,
            data: Array.isArray(data) ? data.slice(0, 5).map(d => ({
                id: d.id,
                filename: d.filename
            })) : data
        });
    }

    logTableDataLoadedEvent(data) {
        this.log("TABLE_DATA_LOADED_EVENT", {
            dataLength: data.length,
            data: data.slice(0, 5).map(d => ({
                id: d.id,
                filename: d.filename
            }))
        });
    }

    generateReport() {
        return {
            timestamp: this.timestamp,
            sessionLogs: this.logs,
            summary: this.generateSummary()
        };
    }

    generateSummary() {
        const summary = {
            totalEvents: this.logs.length,
            removeRequestsSent: 0,
            pdfListUpdatesReceived: 0,
            pdfListUpdatedEvents: 0,
            tableLoadDataCalls: 0,
            tableDataLoadedEvents: 0,
            sequence: []
        };

        this.logs.forEach(log => {
            if (log.message.includes("REMOVE_REQUEST_SENT")) {
                summary.removeRequestsSent++;
                summary.sequence.push("remove_request");
            } else if (log.message === "PDF_LIST_UPDATE_RECEIVED") {
                summary.pdfListUpdatesReceived++;
                summary.sequence.push("pdf_list_update");
            } else if (log.message === "PDF_LIST_UPDATED_EVENT") {
                summary.pdfListUpdatedEvents++;
                summary.sequence.push("pdf_list_updated_event");
            } else if (log.message === "TABLE_LOAD_DATA_CALL") {
                summary.tableLoadDataCalls++;
                summary.sequence.push("table_load_data");
            } else if (log.message === "TABLE_DATA_LOADED_EVENT") {
                summary.tableDataLoadedEvents++;
                summary.sequence.push("table_data_loaded");
            }
        });

        return summary;
    }

    exportToFile() {
        const report = this.generateReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch-delete-diagnostic-${this.timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Create singleton instance
const batchDeleteDiagnostic = new BatchDeleteDiagnostic();

// Monkey patch the UIManager to add diagnostic logging
function patchUIManager() {
    const UIManager = require('../src/frontend/common/ui/ui-manager.js').UIManager;
    
    const originalHandleBatchDelete = UIManager.prototype.#handleBatchDelete;
    UIManager.prototype.#handleBatchDelete = function() {
        // Get selected checkboxes
        let checkboxes = Array.from(DOMUtils.findAllElements(".pdf-item-checkbox:checked") || []);
        if (checkboxes.length === 0) {
            checkboxes = Array.from(DOMUtils.findAllElements('.pdf-table-checkbox:checked') || []);
        }
        
        // Log batch delete start
        batchDeleteDiagnostic.logBatchDeleteStart(checkboxes);
        
        // Call original method
        return originalHandleBatchDelete.call(this);
    };
    
    // Patch removePDF method
    const originalRemovePDF = UIManager.prototype.removePDF;
    UIManager.prototype.removePDF = function(identifier, index) {
        batchDeleteDiagnostic.logRemoveRequestSent(identifier, index);
        return originalRemovePDF.call(this, identifier, index);
    };
}

// Monkey patch PDFManager to add diagnostic logging
function patchPDFManager() {
    const PDFManager = require('../src/frontend/common/pdf/pdf-manager.js').PDFManager;
    
    const originalHandlePDFListUpdate = PDFManager.prototype.#handlePDFListUpdate;
    PDFManager.prototype.#handlePDFListUpdate = function(data, source) {
        batchDeleteDiagnostic.logPDFListUpdateReceived(data, source);
        const result = originalHandlePDFListUpdate.call(this, data, source);
        
        // Log after event emission
        setTimeout(() => {
            batchDeleteDiagnostic.logPDFListUpdatedEvent(this.#pdfs);
        }, 0);
        
        return result;
    };
}

// Monkey patch PDFTable to add diagnostic logging
function patchPDFTable() {
    const PDFTable = require('../src/frontend/common/pdf-table/pdf-table.js').PDFTable;
    
    const originalLoadData = PDFTable.prototype.loadData;
    PDFTable.prototype.loadData = function(data) {
        batchDeleteDiagnostic.logTableLoadDataCall(data);
        
        return originalLoadData.call(this, data).then((result) => {
            setTimeout(() => {
                batchDeleteDiagnostic.logTableDataLoadedEvent(this.state.data);
            }, 0);
            return result;
        });
    };
}

// Initialize patches
if (typeof window !== 'undefined') {
    window.batchDeleteDiagnostic = batchDeleteDiagnostic;
    
    // Wait for DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        patchUIManager();
        patchPDFManager();
        patchPDFTable();
        
        // Add button to export diagnostic report
        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export Batch Delete Diagnostic';
        exportBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 15px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 1000;
        `;
        exportBtn.onclick = () => batchDeleteDiagnostic.exportToFile();
        document.body.appendChild(exportBtn);
    });
}

export default batchDeleteDiagnostic;