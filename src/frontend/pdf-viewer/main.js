// PDF阅读器主逻辑
class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageCount = 1;
        this.scale = 1.0;
        this.canvas = document.getElementById('pdf-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ws = null;
        
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.loadPDF();
    }

    setupWebSocket() {
        try {
            this.ws = new WebSocket('ws://localhost:8765');
            
            this.ws.onopen = () => {
                console.log('WebSocket连接已建立');
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };

            this.ws.onclose = () => {
                console.log('WebSocket连接已关闭');
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
            };
        } catch (error) {
            console.error('WebSocket连接失败:', error);
        }
    }

    handleWebSocketMessage(data) {
        // 可以扩展更多WebSocket功能
        console.log('收到消息:', data);
    }

    setupEventListeners() {
        document.getElementById('back-btn').addEventListener('click', () => {
            window.close();
            // 如果无法关闭，返回主页
            if (!window.closed) {
                window.location.href = '../pdf-home/index.html';
            }
        });

        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.pageNum > 1) {
                this.pageNum--;
                this.renderPage();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if (this.pageNum < this.pageCount) {
                this.pageNum++;
                this.renderPage();
            }
        });

        document.getElementById('zoom-in').addEventListener('click', () => {
            this.scale = Math.min(this.scale + 0.25, 3.0);
            this.renderPage();
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.scale = Math.max(this.scale - 0.25, 0.5);
            this.renderPage();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    if (e.ctrlKey && this.pageNum > 1) {
                        this.pageNum--;
                        this.renderPage();
                    }
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey && this.pageNum < this.pageCount) {
                        this.pageNum++;
                        this.renderPage();
                    }
                    break;
                case '+':
                case '=':
                    if (e.ctrlKey) {
                        this.scale = Math.min(this.scale + 0.25, 3.0);
                        this.renderPage();
                    }
                    break;
                case '-':
                    if (e.ctrlKey) {
                        this.scale = Math.max(this.scale - 0.25, 0.5);
                        this.renderPage();
                    }
                    break;
            }
        });
    }

    async loadPDF() {
        const urlParams = new URLSearchParams(window.location.search);
        const filename = urlParams.get('file');
        
        if (!filename) {
            this.showError('未指定PDF文件');
            return;
        }

        this.showLoading();

        try {
            // 通过WebSocket获取PDF文件路径
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'get_pdf_path',
                    filename: filename
                }));

                // 等待响应或直接使用后端提供的URL
                // 这里简化处理，直接构造路径
                const fileUrl = `file:///${filename}`;
                
                this.pdfDoc = await pdfjsLib.getDocument(fileUrl).promise;
                this.pageCount = this.pdfDoc.numPages;
                this.updatePageInfo();
                
                // 设置标题
                document.getElementById('pdf-title').textContent = 
                    filename.split('/').pop() || 'PDF阅读器';
                
                this.renderPage();
            } else {
                // 如果WebSocket不可用，尝试直接加载
                const fileUrl = `file:///${filename}`;
                this.pdfDoc = await pdfjsLib.getDocument(fileUrl).promise;
                this.pageCount = this.pdfDoc.numPages;
                this.updatePageInfo();
                
                document.getElementById('pdf-title').textContent = 
                    filename.split('/').pop() || 'PDF阅读器';
                
                this.renderPage();
            }
        } catch (error) {
            console.error('加载PDF失败:', error);
            this.showError('加载PDF文件失败: ' + error.message);
        }
    }

    async renderPage() {
        if (!this.pdfDoc) return;

        try {
            const page = await this.pdfDoc.getPage(this.pageNum);
            
            const viewport = page.getViewport({ scale: this.scale });
            this.canvas.height = viewport.height;
            this.canvas.width = viewport.width;

            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;
            this.updatePageInfo();
            this.hideLoading();
        } catch (error) {
            console.error('渲染页面失败:', error);
            this.showError('渲染页面失败: ' + error.message);
        }
    }

    updatePageInfo() {
        document.getElementById('page-info').textContent = 
            `${this.pageNum} / ${this.pageCount}`;
        document.getElementById('zoom-level').textContent = 
            `${Math.round(this.scale * 100)}%`;

        // 更新按钮状态
        document.getElementById('prev-page').disabled = this.pageNum <= 1;
        document.getElementById('next-page').disabled = this.pageNum >= this.pageCount;
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        document.getElementById('pdf-canvas').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('pdf-canvas').style.display = 'block';
    }

    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('pdf-canvas').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').querySelector('p').textContent = message;
    }
}

// 配置PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 初始化应用
const pdfViewer = new PDFViewer();