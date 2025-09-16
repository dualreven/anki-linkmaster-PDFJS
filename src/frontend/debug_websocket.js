// WebSocket通信调试脚本
// 在浏览器控制台中运行此脚本检查WebSocket消息

function debugWebSocket() {
    console.log('=== WebSocket通信调试 ===');
    
    // 检查全局应用状态
    if (window.app && window.app._internal) {
        const app = window.app._internal;
        
        // 检查WebSocket管理器
        if (app._websocketManager) {
            const ws = app._websocketManager;
            console.log('WebSocket连接状态:', ws.isConnected());
            
            // 临时监听WebSocket消息
            const originalOnMessage = ws._onMessage.bind(ws);
            ws._onMessage = function(event) {
                console.log('WebSocket收到消息:', event.data);
                
                try {
                    const data = JSON.parse(event.data);
                    console.log('解析后的消息:', data);
                    
                    // 特别关注PDF列表更新消息
                    if (data.type === 'pdf_list_updated') {
                        console.log('PDF列表更新消息:', data.data);
                        
                        // 检查中文标题
                        if (data.data && Array.isArray(data.data)) {
                            const chinesePDFs = data.data.filter(pdf => 
                                pdf.title && /[\u4e00-\u9fa5]/.test(pdf.title)
                            );
                            console.log('消息中的中文PDF:', chinesePDFs);
                        }
                    }
                } catch (e) {
                    console.log('消息解析错误:', e);
                }
                
                // 调用原始处理函数
                return originalOnMessage(event);
            };
            
            console.log('WebSocket消息监听已启用');
        }
        
        // 检查事件总线
        if (app._eventBus) {
            const eventBus = app._eventBus;
            
            // 监听PDF列表更新事件
            const unsubscribe = eventBus.on('pdf:list:updated', (pdfs) => {
                console.log('事件总线PDF列表更新:', pdfs);
                
                // 检查中文标题
                const chinesePDFs = pdfs.filter(pdf => 
                    pdf.title && /[\u4e00-\u9fa5]/.test(pdf.title)
                );
                console.log('事件总线中的中文PDF:', chinesePDFs);
            });
            
            console.log('事件总线监听已启用');
            
            // 10秒后取消监听
            setTimeout(() => {
                unsubscribe();
                console.log('事件总线监听已取消');
            }, 10000);
        }
    }
    
    // 手动触发PDF列表刷新
    console.log('=== 手动触发操作 ===');
    console.log('执行以下命令手动刷新PDF列表:');
    console.log('window.app._internal._websocketManager.send({type: "get_pdf_list"})');
}

// 运行调试
debugWebSocket();

// 添加全局函数
window.debugWebSocket = debugWebSocket;
console.log('调试函数已注册: debugWebSocket()');