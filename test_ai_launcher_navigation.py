#!/usr/bin/env python3
"""
测试ai_launcher.py的URL导航参数传递

验证ai_launcher.py正确传递page-at和position参数给launcher.py
"""

def test_ai_launcher_argument_parsing():
    """测试ai_launcher.py的参数解析"""
    import sys
    from pathlib import Path

    # 添加项目路径
    PROJECT_ROOT = Path(__file__).parent
    sys.path.insert(0, str(PROJECT_ROOT))

    from ai_launcher import _parse_args

    print("=" * 60)
    print("测试1: 只有pdf-id参数")
    args = _parse_args(["start", "--module", "pdf-viewer", "--pdf-id", "sample"])
    assert args.command == "start"
    assert args.module == "pdf-viewer"
    assert args.pdf_id == "sample"
    assert args.page_at is None
    assert args.position is None
    print(f"✅ 参数解析正确:")
    print(f"   module={args.module}, pdf_id={args.pdf_id}")
    print()

    print("=" * 60)
    print("测试2: pdf-id + page-at参数")
    args = _parse_args(["start", "--module", "pdf-viewer", "--pdf-id", "sample", "--page-at", "5"])
    assert args.command == "start"
    assert args.module == "pdf-viewer"
    assert args.pdf_id == "sample"
    assert args.page_at == 5
    assert args.position is None
    print(f"✅ 参数解析正确:")
    print(f"   module={args.module}, pdf_id={args.pdf_id}, page_at={args.page_at}")
    print()

    print("=" * 60)
    print("测试3: pdf-id + page-at + position（完整参数）")
    args = _parse_args(["start", "--module", "pdf-viewer", "--pdf-id", "sample", "--page-at", "5", "--position", "50.5"])
    assert args.command == "start"
    assert args.module == "pdf-viewer"
    assert args.pdf_id == "sample"
    assert args.page_at == 5
    assert args.position == 50.5
    print(f"✅ 参数解析正确:")
    print(f"   module={args.module}, pdf_id={args.pdf_id}, page_at={args.page_at}, position={args.position}")
    print()

    print("=" * 60)
    print("测试4: 边界值测试 - position为整数")
    args = _parse_args(["start", "--module", "pdf-viewer", "--pdf-id", "test", "--page-at", "1", "--position", "100"])
    assert args.position == 100.0
    print(f"✅ position正确解析为float: {args.position}")
    print()

    print("=" * 60)
    print("测试5: 边界值测试 - position为0")
    args = _parse_args(["start", "--module", "pdf-viewer", "--pdf-id", "test", "--page-at", "1", "--position", "0"])
    assert args.position == 0.0
    print(f"✅ position正确解析为float: {args.position}")
    print()

    print("=" * 60)
    print("✅ 所有测试用例通过！")
    print()
    print("📝 实际使用命令示例:")
    print("  python ai_launcher.py start --module pdf-viewer --pdf-id sample")
    print("  python ai_launcher.py start --module pdf-viewer --pdf-id sample --page-at 5")
    print("  python ai_launcher.py start --module pdf-viewer --pdf-id sample --page-at 5 --position 50")


if __name__ == "__main__":
    test_ai_launcher_argument_parsing()
