#!/usr/bin/env python3
"""
Anki LinkMaster PDFJS 模块切换帮助脚本
"""

import argparse

def main():
    parser = argparse.ArgumentParser(
        description='Anki LinkMaster PDFJS Application - 模块切换帮助',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python app.py                         # 默认加载pdf-viewer模块
  python app.py --module pdf-home       # 加载pdf-home模块
  python app.py --module pdf-viewer     # 加载pdf-viewer模块
  python app.py --port 3001            # 指定Vite端口
  python app.py -m pdf-home -p 3001    # 组合参数

模块功能:
  pdf-home     - PDF文件管理界面 (文件列表、添加/删除操作)
  pdf-viewer   - PDF文档阅读器 (PDF.js集成、页面导航)

注意事项:
  - 确保Vite开发服务器正在运行
  - 端口需要与Vite服务器端口一致
  - 详细文档请查看 docs/module-switching-guide.md
"""
    )
    
    parser.add_argument('--module', '-m', choices=['pdf-home', 'pdf-viewer'], 
                       default='pdf-viewer', help='选择要加载的前端模块 (默认: pdf-viewer)')
    parser.add_argument('--port', '-p', type=int, default=3000, 
                       help='Vite开发服务器端口 (默认: 3000)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Anki LinkMaster PDFJS 模块切换功能")
    print("=" * 60)
    print(f"模块: {args.module}")
    print(f"端口: {args.port}")
    print(f"URL: http://localhost:{args.port}/{args.module}/index.html")
    print("=" * 60)
    
    if args.module == 'pdf-home':
        print("功能: PDF文件管理界面")
        print("- 文件列表展示")
        print("- 文件添加/删除操作")
        print("- 表格视图")
    else:
        print("功能: PDF文档阅读器")
        print("- PDF.js集成")
        print("- 页面导航和缩放")
        print("- 文档预览")
    
    print("=" * 60)

if __name__ == "__main__":
    main()