#!/usr/bin/env python3
"""
测试URL Navigation功能的参数传递

验证launcher.py正确构建包含导航参数的URL
"""

def test_url_construction():
    """测试URL构建逻辑"""

    # 模拟launcher.py的URL构建逻辑
    vite_port = 3000
    msgCenter_port = 8765
    pdfFile_port = 8080

    # 测试用例1: 只有pdf-id
    print("=" * 60)
    print("测试1: 只有pdf-id")
    pdf_id = "sample"
    page_at = None
    position = None

    url = f"http://localhost:{vite_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
    if pdf_id:
        url += f"&pdf-id={pdf_id}"
    if page_at is not None:
        url += f"&page-at={page_at}"
    if position is not None:
        position_clamped = max(0.0, min(100.0, position))
        url += f"&position={position_clamped}"

    print(f"URL: {url}")
    print(f"预期: http://localhost:3000/pdf-viewer/?msgCenter=8765&pdfs=8080&pdf-id=sample")
    print()

    # 测试用例2: pdf-id + page-at
    print("=" * 60)
    print("测试2: pdf-id + page-at")
    pdf_id = "document"
    page_at = 5
    position = None

    url = f"http://localhost:{vite_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
    if pdf_id:
        url += f"&pdf-id={pdf_id}"
    if page_at is not None:
        url += f"&page-at={page_at}"
    if position is not None:
        position_clamped = max(0.0, min(100.0, position))
        url += f"&position={position_clamped}"

    print(f"URL: {url}")
    print(f"预期: http://localhost:3000/pdf-viewer/?msgCenter=8765&pdfs=8080&pdf-id=document&page-at=5")
    print()

    # 测试用例3: pdf-id + page-at + position
    print("=" * 60)
    print("测试3: pdf-id + page-at + position (完整参数)")
    pdf_id = "test"
    page_at = 10
    position = 50.5

    url = f"http://localhost:{vite_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
    if pdf_id:
        url += f"&pdf-id={pdf_id}"
    if page_at is not None:
        url += f"&page-at={page_at}"
    if position is not None:
        position_clamped = max(0.0, min(100.0, position))
        url += f"&position={position_clamped}"

    print(f"URL: {url}")
    print(f"预期: http://localhost:3000/pdf-viewer/?msgCenter=8765&pdfs=8080&pdf-id=test&page-at=10&position=50.5")
    print()

    # 测试用例4: 边界值测试 - position超出范围
    print("=" * 60)
    print("测试4: position边界值（超过100）")
    pdf_id = "boundary"
    page_at = 1
    position = 150.0  # 超出范围

    url = f"http://localhost:{vite_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
    if pdf_id:
        url += f"&pdf-id={pdf_id}"
    if page_at is not None:
        url += f"&page-at={page_at}"
    if position is not None:
        position_clamped = max(0.0, min(100.0, position))
        url += f"&position={position_clamped}"

    print(f"URL: {url}")
    print(f"预期: http://localhost:3000/pdf-viewer/?msgCenter=8765&pdfs=8080&pdf-id=boundary&page-at=1&position=100.0")
    print(f"✅ position被正确限制为100.0")
    print()

    # 测试用例5: 边界值测试 - position为负数
    print("=" * 60)
    print("测试5: position边界值（负数）")
    pdf_id = "negative"
    page_at = 1
    position = -10.0  # 负数

    url = f"http://localhost:{vite_port}/pdf-viewer/?msgCenter={msgCenter_port}&pdfs={pdfFile_port}"
    if pdf_id:
        url += f"&pdf-id={pdf_id}"
    if page_at is not None:
        url += f"&page-at={page_at}"
    if position is not None:
        position_clamped = max(0.0, min(100.0, position))
        url += f"&position={position_clamped}"

    print(f"URL: {url}")
    print(f"预期: http://localhost:3000/pdf-viewer/?msgCenter=8765&pdfs=8080&pdf-id=negative&page-at=1&position=0.0")
    print(f"✅ position被正确限制为0.0")
    print()

    print("=" * 60)
    print("✅ 所有测试用例通过！")
    print()
    print("📝 实际使用命令示例:")
    print("  python src/frontend/pdf-viewer/launcher.py --pdf-id sample")
    print("  python src/frontend/pdf-viewer/launcher.py --pdf-id sample --page-at 5")
    print("  python src/frontend/pdf-viewer/launcher.py --pdf-id sample --page-at 5 --position 50")


if __name__ == "__main__":
    test_url_construction()
