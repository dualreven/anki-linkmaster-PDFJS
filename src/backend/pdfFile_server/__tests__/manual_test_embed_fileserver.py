"""
EmbedFileServer 手动功能测试

快速验证服务器基本功能
"""

import sys
import time
import tempfile
import threading
from pathlib import Path

# 确保项目根目录在 sys.path 中
project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QTimer
from src.backend.pdfFile_server.embed_fileserver import EmbedFileServer
import urllib.request
import urllib.error


def test_basic_functionality():
    """测试基本功能"""
    print("="*60)
    print("EmbedFileServer 功能测试")
    print("="*60)

    # 创建临时目录和测试文件
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # 创建测试文件
        test_pdf = tmpdir / "test.pdf"
        test_pdf.write_bytes(b"%PDF-1.4\nTest PDF content")

        test_txt = tmpdir / "test.txt"
        test_txt.write_text("Hello, World!", encoding='utf-8')

        # 创建子目录
        subdir = tmpdir / "subdir"
        subdir.mkdir()
        nested_file = subdir / "nested.txt"
        nested_file.write_text("Nested content", encoding='utf-8')

        print(f"\n✅ 测试文件已创建:")
        print(f"   - {test_pdf.name}")
        print(f"   - {test_txt.name}")
        print(f"   - subdir/{nested_file.name}")

        # 创建QApplication
        app = QApplication(sys.argv)

        # 创建服务器
        server = EmbedFileServer(root_dir=str(tmpdir), port=8888)

        # 监听信号
        request_log = []
        server.request_received.connect(
            lambda method, path: request_log.append(f"{method} {path}")
        )

        # 启动服务器
        print(f"\n🚀 启动服务器...")
        if not server.start():
            print("❌ 服务器启动失败")
            return False

        print(f"✅ 服务器已启动: http://127.0.0.1:{server.port}")

        # 定义测试用例
        test_cases = [
            ("/test.pdf", 200, "PDF文件"),
            ("/test.txt", 200, "文本文件"),
            ("/subdir/nested.txt", 200, "嵌套文件"),
            ("/nonexistent.pdf", 404, "不存在的文件"),
            ("/../../../etc/passwd", 404, "路径穿越攻击"),
        ]

        print(f"\n📝 运行测试用例:")
        passed = 0
        failed = 0

        for path, expected_code, description in test_cases:
            try:
                url = f"http://127.0.0.1:8888{path}"
                response = urllib.request.urlopen(url)
                actual_code = response.status

                if actual_code == expected_code:
                    print(f"   ✅ {description}: {actual_code}")
                    passed += 1
                else:
                    print(f"   ❌ {description}: 期望 {expected_code}, 实际 {actual_code}")
                    failed += 1

            except urllib.error.HTTPError as e:
                if e.code == expected_code:
                    print(f"   ✅ {description}: {e.code}")
                    passed += 1
                else:
                    print(f"   ❌ {description}: 期望 {expected_code}, 实际 {e.code}")
                    failed += 1

            except Exception as e:
                print(f"   ❌ {description}: 异常 - {e}")
                failed += 1

            # 处理事件循环
            app.processEvents()
            time.sleep(0.05)

        # 检查CORS头
        print(f"\n🔍 检查CORS头:")
        try:
            response = urllib.request.urlopen("http://127.0.0.1:8888/test.txt")
            cors_header = response.headers.get('Access-Control-Allow-Origin')
            if cors_header == '*':
                print(f"   ✅ CORS头正确: {cors_header}")
                passed += 1
            else:
                print(f"   ❌ CORS头错误: {cors_header}")
                failed += 1
        except Exception as e:
            print(f"   ❌ CORS测试失败: {e}")
            failed += 1

        # 处理事件循环
        app.processEvents()
        time.sleep(0.1)

        # 检查请求日志
        print(f"\n📊 请求日志 ({len(request_log)} 个请求):")
        for log in request_log:
            print(f"   - {log}")

        # 停止服务器
        print(f"\n🛑 停止服务器...")
        server.stop()
        print(f"✅ 服务器已停止")

        # 输出结果
        print(f"\n" + "="*60)
        print(f"测试结果:")
        print(f"   通过: {passed}")
        print(f"   失败: {failed}")
        print(f"   总计: {passed + failed}")
        print("="*60)

        return failed == 0


if __name__ == "__main__":
    try:
        success = test_basic_functionality()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
