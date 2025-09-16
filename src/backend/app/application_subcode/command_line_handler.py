"""
Anki LinkMaster PDFJS - 命令行文件处理器
包含处理命令行传入文件路径的方法
"""

import os
import shutil
import logging

# 配置日志
logger = logging.getLogger(__name__)


class CommandLineHandler:
    """命令行文件处理器类"""
    
    def __init__(self, app_instance):
        """初始化命令行处理器
        
        Args:
            app_instance: 主应用实例
        """
        self.app = app_instance
        self.pdf_manager = app_instance.pdf_manager
        self.websocket_server = app_instance.websocket_server

    def handle_command_line_file(self, file_path, module):
        """处理命令行传入的文件路径
        
        Args:
            file_path: PDF文件路径
            module: 当前加载的模块
        """
        if not file_path:
            return
            
        if module != "pdf-viewer":
            logger.warning(f"文件路径参数仅在pdf-viewer模块有效，当前模块: {module}")
            return
            
        if not os.path.exists(file_path):
            logger.error(f"文件不存在: {file_path}")
            return
            
        if not file_path.lower().endswith('.pdf'):
            logger.error(f"文件格式不支持，仅支持PDF文件: {file_path}")
            return
            
        try:
            # 确保data/pdfs目录存在（项目根目录）
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            pdfs_dir = os.path.join(project_root, 'data', 'pdfs')
            os.makedirs(pdfs_dir, exist_ok=True)
            
            # 复制文件到data/pdfs目录
            filename = os.path.basename(file_path)
            dest_path = os.path.join(pdfs_dir, filename)
            
            if file_path != dest_path:
                shutil.copy2(file_path, dest_path)
                logger.info(f"复制文件到HTTP服务目录: {file_path} -> {dest_path}")
            
            # 添加PDF文件到管理器
            success = self.pdf_manager.add_file(dest_path)
            if success:
                logger.info(f"成功添加PDF文件: {file_path}")
                
                # 获取文件ID（通过文件名查找）
                file_id = None
                for pdf_file in self.pdf_manager.get_files():
                    if pdf_file.get('filename') == filename:
                        file_id = pdf_file.get('id')
                        break
                
                if file_id and self.websocket_server:
                    # 通过WebSocket通知前端加载文件
                    self.websocket_server.broadcast_message({
                        "type": "load_pdf_file",
                        "data": {
                            "fileId": file_id,
                            "filename": filename,
                            "url": f"/pdfs/{filename}"
                        }
                    })
            else:
                logger.warning(f"添加PDF文件失败: {file_path}")
                
        except Exception as e:
            logger.error(f"处理命令行文件路径时出错: {str(e)}")