import PDFHomeAppManager from './pdf-home-app.js';

document.addEventListener('DOMContentLoaded', () => {
    const app = new PDFHomeAppManager();
    app.initialize();
    // 可选：挂到全局方便调试
    window.appManager = app;
});
