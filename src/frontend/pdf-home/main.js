// PDF主页主逻辑
class PDFHomeManager {
    constructor() {
        this.ws = null;
        this.pdfs = [];
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.loadPDFs();
    }

    setupWebSocket() {
        try {
            this.ws = new WebSocket('ws://localhost:8765');
            
            this.ws.onopen = () => {
                console.log('WebSocket连接已建立');
                this.hideError();
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };

            this.ws.onclose = () => {
                console.log('WebSocket连接已关闭');
                this.showError('与服务器的连接已断开，正在尝试重新连接...');
                // 尝试重新连接
                setTimeout(() => this.setupWebSocket(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.showError('WebSocket连接错误: ' + error.message);
            };
        } catch (error) {
            console.error('WebSocket连接失败:', error);
            this.showError('WebSocket连接失败: ' + error.message);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'pdf_list':
                this.updatePDFList(data.pdfs);
                break;
            case 'pdf_added':
                this.addPDFToList(data.pdf);
                break;
            case 'pdf_removed':
                this.removePDFFromList(data.filename);
                break;
            case 'error':
                // 增强错误处理兼容性，支持调试报告中提到的嵌套格式
                let errorCode;
                let errorMessage;
                
                // 兼容新旧格式，根据调试报告的方案
                if (data.data && data.data.code) {
                    errorCode = data.data.code;
                    errorMessage = data.data.message || '未知错误';
                } else if (data.error_code) {
                    errorCode = data.error_code;
                    errorMessage = data.message || '未知错误';
                } else if (data.code) {
                    errorCode = data.code;
                    errorMessage = data.message || '未知错误';
                } else {
                    errorMessage = data.message || '发生未知错误';
                }
                
                // 根据错误码显示用户友好的消息，符合调试报告的要求
                switch(errorCode) {
                    case 'FILE_EXISTS':
                        errorMessage = '文件已存在于列表中';
                        break;
                    case 'FILE_NOT_FOUND':
                        errorMessage = '文件不存在或无法访问';
                        break;
                    case 'PERMISSION_DENIED':
                        errorMessage = '文件权限不足';
                        break;
                    case 'UNKNOWN_MESSAGE_TYPE':
                        errorMessage = '未知的消息类型';
                        break;
                    case 'INVALID_MESSAGE_FORMAT':
                        errorMessage = '消息格式错误';
                        break;
                    case 'INTERNAL_ERROR':
                        errorMessage = '服务器内部错误';
                        break;
                    case 'MISSING_PARAMETERS':
                        errorMessage = '缺少必要参数';
                        break;
                    case 'ADD_FILE_FAILED':
                        errorMessage = '添加文件失败';
                        break;
                    case 'INVALID_PARAMETER_FORMAT':
                        errorMessage = '参数格式错误';
                        break;
                    case 'REMOVE_FILE_FAILED':
                        errorMessage = '删除文件失败';
                        break;
                    case 'DIRECTORY_NOT_FOUND':
                        errorMessage = '目录未找到';
                        break;
                    default:
                        errorMessage = errorMessage || '操作失败';
                }
                
                this.showError(errorMessage);
                break;
        }
    }

    setupEventListeners() {
        document.getElementById('add-pdf-btn').addEventListener('click', () => {
            this.requestFileSelection();
        });
    }

    requestFileSelection() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // 发送请求到后端，触发QT文件选择对话框
            this.ws.send(JSON.stringify({
                type: 'request_file_selection'
            }));
            
            console.log('已发送文件选择请求');
        } else {
            this.showError('WebSocket连接未建立，无法选择文件');
        }
    }

    loadPDFs() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'get_pdf_list'
            }));
        }
    }

    // 这个方法现在由后端文件选择后自动调用
    addPDF(fileInfo) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // 接收后端选择的文件信息
            const tempId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            this.ws.send(JSON.stringify({
                type: 'add_pdf',
                fileInfo: fileInfo,
                tempId: tempId
            }));
            
            console.log('已发送添加PDF请求:', fileInfo.name);
        }
    }

    removePDF(filename) {
        if (confirm('确定要删除这个PDF文件吗？')) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'remove_pdf',
                    filename: filename
                }));
            }
        }
    }

    updatePDFList(pdfs) {
        this.pdfs = pdfs;
        this.renderPDFList();
    }

    addPDFToList(pdf) {
        this.pdfs.push(pdf);
        this.renderPDFList();
    }

    removePDFFromList(filename) {
        this.pdfs = this.pdfs.filter(pdf => pdf.filename !== filename);
        this.renderPDFList();
    }

    renderPDFList() {
        const container = document.getElementById('pdf-list');
        const emptyState = document.getElementById('empty-state');

        if (this.pdfs.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        container.innerHTML = this.pdfs.map(pdf => this.createPDFCard(pdf)).join('');
    }

    createPDFCard(pdf) {
        return `
            <div class="pdf-card" data-filename="${pdf.filename}">
                <div class="pdf-title">${this.escapeHtml(pdf.title)}</div>
                <div class="pdf-path">${this.escapeHtml(pdf.path)}</div>
                <div class="pdf-actions">
                    <button class="btn btn-small" onclick="pdfHome.openPDF('${pdf.filename}')">打开</button>
                    <button class="btn btn-small danger" onclick="pdfHome.removePDF('${pdf.filename}')">删除</button>
                </div>
            </div>
        `;
    }

    openPDF(filename) {
        // 在新窗口打开PDF阅读器
        const viewerUrl = `../pdf-viewer/index.html?file=${encodeURIComponent(filename)}`;
        window.open(viewerUrl, '_blank');
    }

    removePDF(filename) {
        if (confirm('确定要删除这个PDF文件吗？')) {
            this.removePDF(filename);
        }
    }

    showError(message) {
        // 创建或更新错误消息元素
        let errorElement = document.getElementById('error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error-message';
            errorElement.className = 'error-message';
            document.body.appendChild(errorElement);
        }
        
        errorElement.textContent = '错误: ' + message;
        errorElement.style.display = 'block';
        
        // 5秒后自动隐藏错误消息
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }
    
    hideError() {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
const pdfHome = new PDFHomeManager();