/**
 * PDF主页UI管理器
 * 处理PDF主页的UI渲染和交互
 */
import UIManager from "../common/ui-manager.js";

class PDFHomeUIManager extends UIManager {
    constructor() {
        super({
            containerId: 'pdf-home-container'
        });
        
        this.pdfCardTemplate = `
            <div class="pdf-card" data-filename="{{filename}}">
                <div class="pdf-title">{{title}}</div>
                <div class="pdf-path">{{path}}</div>
                <div class="pdf-actions">
                    <button class="btn btn-small" data-action="open" data-filename="{{filename}}">打开</button>
                    <button class="btn btn-small danger" data-action="remove" data-filename="{{filename}}">删除</button>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        // 添加PDF按钮
        this.addEventListener('addPdfBtn', 'click', () => {
            this.emit('action', {
                type: 'websocket_send',
                messageType: 'request_file_selection'
            });
        });
        
        // 调试按钮
        this.addEventListener('debugBtn', 'click', () => {
            this.toggleDebugStatus();
        });
        
        // PDF卡片操作委托
        if (this.elements.container) {
            this.elements.container.addEventListener('click', (event) => {
                this.handlePDFCardAction(event);
            });
        }
    }
    
    render() {
        const { pdfs = [], loading = false, websocketConnected = false } = this.getState();
        
        if (!this.elements.container) return;
        
        // 清空容器
        this.elements.container.innerHTML = '';
        
        // 添加调试状态显示
        const debugStatus = this.createDebugStatus(websocketConnected, loading);
        this.elements.container.appendChild(debugStatus);
        
        // 添加主要内容区域
        const mainContent = this.createMainContent(pdfs, loading);
        this.elements.container.appendChild(mainContent);
    }
    
    createDebugStatus(websocketConnected, loading) {
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-status';
        debugDiv.style.cssText = `
            display: none;
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 15px;
            font-family: monospace;
            font-size: 12px;
        `;
        
        const state = window.appManager ? window.appManager.getState() : null;
        const pdfCount = Array.isArray(this.getState().pdfs) ? this.getState().pdfs.length : 0;
        
        debugDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>🔍 调试状态</strong>
                <button onclick="this.parentElement.parentElement.style.display='none'" style="background: #f44; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">隐藏</button>
            </div>
            <div id="debug-content">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <div><strong>WebSocket:</strong> ${websocketConnected ? '🟢 已连接' : '🔴 未连接'}</div>
                    <div><strong>PDF数量:</strong> ${pdfCount}</div>
                    <div><strong>加载状态:</strong> ${loading ? '⏳ 加载中' : '✅ 就绪'}</div>
                    <div><strong>环境:</strong> ${null ? 'QtWebEngine' : '标准浏览器'}</div>
                </div>
                <div style="margin-top: 8px; font-size: 10px; color: #666;">
                    <strong>提示:</strong> 按 Ctrl+D 打开详细调试面板
                </div>
            </div>
        `;
        
        return debugDiv;
    }
    
    createMainContent(pdfs, loading) {
        const mainContent = document.createElement('main');
        
        // 创建头部
        const header = this.createHeader();
        mainContent.appendChild(header);
        
        // 创建内容区域
        const content = this.createContent(pdfs, loading);
        mainContent.appendChild(content);
        
        return mainContent;
    }
    
    createHeader() {
        const header = document.createElement('header');
        header.innerHTML = `
            <h1>PDF文件管理</h1>
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="addPdfBtn" class="btn primary">添加PDF文件</button>
                <button id="debugBtn" class="btn" style="background: #666; color: white;" title="显示调试面板 (Ctrl+D)">🔧 调试</button>
            </div>
        `;
        
        return header;
    }
    
    createContent(pdfs, loading) {
        const content = document.createElement('div');
        
        if (loading) {
            // 显示加载状态
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.textContent = '正在加载...';
            content.appendChild(loadingDiv);
        } else if (pdfs.length === 0) {
            // 显示空状态
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.style.cssText = `
                text-align: center;
                padding: 60px 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            emptyState.innerHTML = `
                <div class="empty-icon" style="font-size: 48px; margin-bottom: 20px;">📄</div>
                <h3 style="color: #2c3e50; margin-bottom: 10px;">暂无PDF文件</h3>
                <p style="color: #7f8c8d;">点击"添加PDF文件"按钮开始管理您的PDF文档</p>
            `;
            content.appendChild(emptyState);
        } else {
            // 显示PDF列表
            const pdfList = document.createElement('div');
            pdfList.id = 'pdf-list';
            pdfList.className = 'pdf-grid';
            pdfList.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
            `;
            
            // 添加PDF卡片
            pdfs.forEach(pdf => {
                const card = this.createPDFCard(pdf);
                pdfList.appendChild(card);
            });
            
            content.appendChild(pdfList);
        }
        
        return content;
    }
    
    createPDFCard(pdf) {
        const cardHTML = this.renderTemplate(this.pdfCardTemplate, {
            filename: pdf.filename,
            title: pdf.title || pdf.filename,
            path: pdf.filepath || pdf.path || ''
        });
        
        const card = document.createElement('div');
        card.innerHTML = cardHTML;
        return card.firstElementChild;
    }
    
    handlePDFCardAction(event) {
        const button = event.target.closest('button');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        const filename = button.getAttribute('data-filename');
        
        if (!action || !filename) return;
        
        event.preventDefault();
        
        switch (action) {
            case 'open':
                this.emit('action', {
                    type: 'business_logic',
                    action: 'openPDF',
                    filename: filename
                });
                break;
                
            case 'remove':
                if (confirm('确定要删除这个PDF文件吗？')) {
                    this.emit('action', {
                        type: 'business_logic',
                        action: 'removePDF',
                        filename: filename
                    });
                }
                break;
        }
    }
    
    toggleDebugStatus() {
        const debugStatus = document.getElementById('debug-status');
        if (debugStatus) {
            const isVisible = debugStatus.style.display !== 'none';
            debugStatus.style.display = isVisible ? 'none' : 'block';
        }
    }
    
    updatePDFList(pdfs) {
        this.setState('pdfs', pdfs);
        this.render();
    }
    
    setLoading(loading) {
        this.setState('loading', loading);
        this.render();
    }
    
    setWebSocketConnected(connected) {
        this.setState('websocketConnected', connected);
        this.render();
    }
    
    showError(message) {
        this.showError(message);
    }
    
    showSuccess(message) {
        this.showSuccess(message);
    }
}

export default PDFHomeUIManager;
