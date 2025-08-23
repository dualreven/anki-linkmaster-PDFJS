/**
 * PDF主页业务逻辑管理器
 * 处理PDF文件管理的业务逻辑
 */
import BusinessLogicManager from "../common/business-logic-manager.js";

class PDFHomeBusinessLogicManager extends BusinessLogicManager {
    constructor() {
        super({
            name: 'PDFHomeBusinessLogic',
            apiBaseUrl: '/api'
        });
        
        this.pdfs = [];
        this.selectedPDF = null;
    }
    
    setupEventListeners() {
        // WebSocket消息处理
        if (window.appManager && window.appManager.components.websocket) {
            const ws = window.appManager.components.websocket;
            
            ws.onMessage('pdf_list_updated', (data) => {
                this.handlePDFListUpdated(data);
            });
            
            ws.onMessage('success', (data) => {
                this.handleSuccessResponse(data);
            });
            
            ws.onMessage('error', (data) => {
                this.handleErrorResponse(data);
            });
        }
    }
    
    async loadInitialData() {
        this.debug.info('加载初始PDF数据');
        
        try {
            this.setLoading(true);
            await this.loadPDFList();
        } catch (error) {
            this.debug.error('加载初始数据失败:', error);
            this.setError('加载PDF列表失败');
        } finally {
            this.setLoading(false);
        }
    }
    
    async loadPDFList() {
        this.debug.info(`window.appManager=${window.appManager}`);
        
        // 使用事件驱动方式等待AppManager初始化完成
        this._waitForAppManagerWithEvent().then(appManager => {
            if (!appManager) {
                this.debug.error('AppManager初始化失败');
                this.setError('应用初始化失败，请刷新页面');
                return;
            }
            
            const websocket = appManager.components.websocket;
            if (!websocket) {
                this.debug.error('WebSocket组件未找到');
                this.setError('WebSocket组件未初始化');
                return;
            }
            
            // 检查WebSocket连接状态
            if (typeof websocket.isConnected === 'function' && !websocket.isConnected()) {
                this.debug.warn('WebSocket连接未建立，等待连接...');
                this._waitForWebSocketConnection(websocket).then(() => {
                    this._sendLoadPDFListRequest();
                }).catch(error => {
                    this.debug.error('WebSocket连接失败:', error);
                    this.setError('WebSocket连接失败，请检查网络后重试');
                });
            } else {
                // 直接发送请求
                this._sendLoadPDFListRequest();
            }
        }).catch(error => {
            this.debug.error('等待AppManager时出错:', error);
            this.setError('应用初始化出错，请刷新页面');
        });
    }
    
    /**
     * 使用事件驱动方式等待AppManager初始化完成
     * @returns {Promise<Object>} AppManager实例
     */
    async _waitForAppManagerWithEvent() {
        return new Promise((resolve) => {
            // 如果已经存在，直接返回
            if (window.appManager) {
                resolve(window.appManager);
                return;
            }
            
            // 监听AppManager就绪事件
            const onAppManagerReady = (event) => {
                const appManager = event.detail.appManager;
                if (appManager) {
                    resolve(appManager);
                } else {
                    resolve(null);
                }
                document.removeEventListener('appManagerReady', onAppManagerReady);
            };
            
            document.addEventListener('appManagerReady', onAppManagerReady);
            
            // 超时保护（5秒）
            setTimeout(() => {
                document.removeEventListener('appManagerReady', onAppManagerReady);
                this.debug.warn('AppManager初始化超时');
                resolve(null);
            }, 5000);
        });
    }
    
    /**
     * 等待WebSocket连接
     * @param {Object} websocket WebSocket实例
     * @returns {Promise<void>}
     */
    async _waitForWebSocketConnection(websocket) {
        return new Promise((resolve, reject) => {
            const maxAttempts = 6;
            let attempts = 0;
            
            const checkConnection = () => {
                if (websocket.isConnected && websocket.isConnected()) {
                    resolve();
                    return;
                }
                
                attempts++;
                if (attempts >= maxAttempts) {
                    reject(new Error('WebSocket连接超时'));
                    return;
                }
                
                setTimeout(checkConnection, 500);
            };
            
            checkConnection();
        });
    }
    
    /**
     * 发送加载PDF列表请求
     */
    _sendLoadPDFListRequest() {
        if (window.appManager && window.appManager.components.websocket) {
            window.appManager.components.websocket.send('get_pdf_list');
            this.debug.info('正在通过WebSocket获取PDF列表...');
        }
    }
    
    handlePDFListUpdated(data) {
        this.debug.info('处理PDF列表更新');
        
        if (data.data && data.data.files) {
            // 应用数据映射层转换
            this.pdfs = data.data.files.map(file => this.mapBackendDataToTableData(file));
            this.setData('pdfs', this.pdfs);
            this.emit('pdfListUpdated', this.pdfs);
        }
    }
    
    handleSuccessResponse(data) {
        this.debug.info('处理成功响应');
        
        if (data.data && data.data.original_type === 'get_pdf_list' && data.data.result && data.data.result.files) {
            // 应用数据映射层转换
            this.pdfs = data.data.result.files.map(file => this.mapBackendDataToTableData(file));
            this.setData('pdfs', this.pdfs);
            this.emit('pdfListUpdated', this.pdfs);
        }
    }
    
    handleErrorResponse(data) {
        this.debug.error('处理错误响应:', data);
        
        let errorMessage = '操作失败';
        if (data.data && data.data.message) {
            errorMessage = data.data.message;
        } else if (data.message) {
            errorMessage = data.message;
        }
        
        this.setError(errorMessage);
        this.emit('error', errorMessage);
    }
    
    async addPDF(fileInfo) {
        this.debug.info('添加PDF文件:', fileInfo);
        
        try {
            this.setLoading(true);
            this.clearError();
            
            if (window.appManager && window.appManager.components.websocket) {
                window.appManager.components.websocket.send('add_pdf', { fileInfo });
            }
            
            this.emit('pdfAddRequested', fileInfo);
        } catch (error) {
            this.debug.error('添加PDF失败:', error);
            this.setError('添加PDF文件失败');
            this.emit('pdfAddFailed', error);
        } finally {
            this.setLoading(false);
        }
    }
    
    async removePDF(filename) {
        this.debug.info('删除PDF文件:', filename);
        
        try {
            this.setLoading(true);
            this.clearError();
            
            if (window.appManager && window.appManager.components.websocket) {
                window.appManager.components.websocket.send('remove_pdf', { filename });
            }
            
            this.emit('pdfRemoveRequested', filename);
        } catch (error) {
            this.debug.error('删除PDF失败:', error);
            this.setError('删除PDF文件失败');
            this.emit('pdfRemoveFailed', error);
        } finally {
            this.setLoading(false);
        }
    }
    
    openPDF(filename) {
        this.debug.info('打开PDF文件:', filename);
        
        const pdf = this.pdfs.find(p => p.filename === filename);
        if (!pdf) {
            this.setError('找不到指定的PDF文件');
            return;
        }
        
        const filepath = pdf.filepath || pdf.path;
        if (!filepath) {
            this.setError('PDF文件路径无效');
            return;
        }
        
        // 在新窗口中打开PDF
        if (filepath.startsWith('file://') || filepath.includes(':\\') || filepath.startsWith('/')) {
            window.open(filepath, '_blank');
        } else {
            const viewerUrl = `../pdf-viewer/index.html?file=${encodeURIComponent(filepath)}`;
            window.open(viewerUrl, '_blank');
        }
        
        this.emit('pdfOpened', pdf);
    }
    
    selectPDF(filename) {
        this.debug.info('选择PDF文件:', filename);
        
        const pdf = this.pdfs.find(p => p.filename === filename);
        this.selectedPDF = pdf;
        this.setState('selectedPDF', pdf);
        
        this.emit('pdfSelected', pdf);
    }
    
    getPDFs() {
        return this.pdfs;
    }
    
    getPDF(filename) {
        return this.pdfs.find(p => p.filename === filename);
    }
    
    getSelectedPDF() {
        return this.selectedPDF;
    }
    
    searchPDFs(query) {
        if (!query) {
            return this.pdfs;
        }
        
        const lowercaseQuery = query.toLowerCase();
        return this.pdfs.filter(pdf => 
            pdf.title.toLowerCase().includes(lowercaseQuery) ||
            pdf.filename.toLowerCase().includes(lowercaseQuery) ||
            (pdf.path && pdf.path.toLowerCase().includes(lowercaseQuery))
        );
    }

    mapBackendDataToTableData(backendData) {
        // 数据映射函数，将后端数据格式转换为前端表格格式
        try {
            return {
                id: backendData.id || backendData.filename,
                filename: backendData.filename || 'unknown.pdf',
                filepath: backendData.filepath || backendData.path || '',
                title: backendData.title || backendData.filename || 'unknown.pdf',
                size: backendData.file_size || backendData.size || 0,
                created_time: this.convertTimeToTimestamp(backendData.created_time),
                modified_time: this.convertTimeToTimestamp(backendData.modified_time),
                page_count: backendData.page_count || 0,
                author: backendData.author || '',
                tags: Array.isArray(backendData.tags) ? backendData.tags : [],
                notes: backendData.notes || '',
                import_date: backendData.import_date || new Date().toISOString(),
                access_date: backendData.access_date || new Date().toISOString(),
                importance: backendData.importance || 'medium',
                unread_pages: backendData.unread_pages || 0,
                total_pages: backendData.total_pages || backendData.page_count || 0,
                annotations_count: backendData.annotations_count || 0,
                cards_count: backendData.cards_count || 0,
                select: '',
                actions: ''
            };
        } catch (error) {
            console.error('数据映射失败:', error);
            return {
                id: backendData.filename || 'unknown',
                filename: backendData.filename || 'unknown.pdf',
                filepath: '',
                title: backendData.filename || 'unknown.pdf',
                size: 0,
                created_time: 0,
                modified_time: 0,
                page_count: 0,
                select: '',
                actions: ''
            };
        }
    }

    convertTimeToTimestamp(timeValue) {
        if (!timeValue) return 0;
        if (typeof timeValue === 'number') return timeValue;
        if (typeof timeValue === 'string') {
            const date = new Date(timeValue);
            return isNaN(date.getTime()) ? 0 : date.getTime();
        }
        return 0;
    }
}

export default PDFHomeBusinessLogicManager;
