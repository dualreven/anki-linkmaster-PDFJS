"""
测试PDF列表输出 - 验证WebSocket返回的数据格式
"""
import json
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.backend.pdf_manager.manager import PDFManager

def test_pdf_list_output():
    """测试PDF列表输出格式"""

    print("\n" + "="*70)
    print("测试 PDF 列表输出格式")
    print("="*70 + "\n")

    # 创建管理器
    manager = PDFManager(data_dir="data")

    # 获取文件列表（模拟WebSocket调用）
    files = manager.get_files()

    print(f"📊 获取到 {len(files)} 个PDF记录\n")

    if files:
        # 显示第一个PDF的完整字段
        first_pdf = files[0]
        print("=" * 70)
        print("第一个PDF记录的字段（JSON格式）:")
        print("=" * 70)
        print(json.dumps(first_pdf, indent=2, ensure_ascii=False))
        print("\n")

        # 检查扩展字段
        print("=" * 70)
        print("扩展字段检查:")
        print("=" * 70)

        extended_fields = [
            'last_accessed_at',
            'review_count',
            'rating',
            'is_visible',
            'total_reading_time',
            'due_date',
            'tags'
        ]

        missing_fields = []
        present_fields = []

        for field in extended_fields:
            if field in first_pdf:
                value = first_pdf[field]
                present_fields.append((field, value))
                status = "✓"
            else:
                missing_fields.append(field)
                status = "✗"

            print(f"{status} {field:25s} : {first_pdf.get(field, 'MISSING')}")

        print("\n")

        # 统计所有PDF的字段值
        print("=" * 70)
        print("所有PDF的扩展字段统计:")
        print("=" * 70)

        # 评分统计
        ratings = [f.get('rating', 0) for f in files]
        rating_dist = {i: ratings.count(i) for i in range(6)}
        print(f"评分分布: {rating_dist}")

        # 复习次数统计
        review_counts = [f.get('review_count', 0) for f in files]
        print(f"复习次数范围: {min(review_counts)} - {max(review_counts)}")
        print(f"平均复习次数: {sum(review_counts) / len(review_counts):.1f}")

        # 标签统计
        all_tags = []
        for f in files:
            all_tags.extend(f.get('tags', []))
        print(f"标签总数: {len(all_tags)}")
        print(f"不同标签数: {len(set(all_tags))}")
        if all_tags:
            print(f"标签列表: {', '.join(set(all_tags))}")

        # 有截止日期的PDF数量
        has_due_date = sum(1 for f in files if f.get('due_date', 0) > 0)
        print(f"有截止日期的PDF: {has_due_date}/{len(files)}")

        print("\n")

        # 验证结果
        if missing_fields:
            print("❌ 测试失败！以下字段缺失:")
            for field in missing_fields:
                print(f"   - {field}")
            return False
        else:
            print("✅ 测试通过！所有扩展字段都存在且有值")
            return True
    else:
        print("⚠️  没有PDF记录")
        return False


if __name__ == '__main__':
    success = test_pdf_list_output()
    sys.exit(0 if success else 1)
