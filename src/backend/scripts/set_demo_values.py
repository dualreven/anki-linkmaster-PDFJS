"""
为现有PDF记录设置演示数据
给每个PDF设置一些合理的默认值，使界面看起来更完整
"""
import json
import time
import random
from pathlib import Path

# 预定义的标签池
TAG_POOL = [
    "学习资料", "工作文档", "技术文档", "论文", "教程",
    "重要", "待读", "已读", "参考资料", "收藏"
]

def set_demo_values():
    """为现有PDF记录设置演示数据"""

    # 数据文件路径
    data_file = Path(__file__).parent.parent.parent.parent / "data" / "pdf_files.json"

    if not data_file.exists():
        print(f"❌ 数据文件不存在: {data_file}")
        return False

    # 备份原文件
    backup_file = data_file.with_suffix('.json.backup')
    print(f"📋 备份原文件到: {backup_file}")
    import shutil
    shutil.copy2(data_file, backup_file)

    # 读取数据
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    files = data.get('files', {})
    if not files:
        print("⚠️ 没有找到任何PDF记录")
        return False

    print(f"\n🔧 开始为 {len(files)} 个PDF设置演示数据...\n")

    current_time = int(time.time())

    for idx, (file_id, pdf) in enumerate(files.items(), 1):
        filename = pdf.get('filename', 'unknown')

        # 设置上次访问时间（随机在过去30天内）
        days_ago = random.randint(0, 30)
        pdf['last_accessed_at'] = current_time - (days_ago * 86400) - random.randint(0, 86400)

        # 设置复习次数（0-10次）
        pdf['review_count'] = random.randint(0, 10)

        # 设置评分（0-5星，有20%概率为0表示未评分）
        pdf['rating'] = random.choice([0, 0, 1, 2, 3, 3, 4, 4, 5])

        # 设置标签（随机选择1-3个标签）
        num_tags = random.randint(1, 3)
        pdf['tags'] = random.sample(TAG_POOL, num_tags)

        # 保持可见性为True
        pdf['is_visible'] = True

        # 设置学习时长（0-7200秒，即0-2小时）
        pdf['total_reading_time'] = random.randint(0, 7200)

        # 设置截止日期（50%有截止日期，在未来7-30天内）
        if random.random() > 0.5:
            days_future = random.randint(7, 30)
            pdf['due_date'] = current_time + (days_future * 86400)
        else:
            pdf['due_date'] = 0

        print(f"✓ [{idx}/{len(files)}] {filename[:40]:40s} | "
              f"{'★' * pdf['rating']}{'☆' * (5 - pdf['rating'])} | "
              f"复习{pdf['review_count']}次 | "
              f"标签: {', '.join(pdf['tags'][:2])}")

    # 写回文件
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 演示数据设置完成！")
    print(f"📁 数据文件: {data_file}")
    print(f"💾 备份文件: {backup_file}")
    print(f"\n💡 提示: 刷新前端页面查看效果")

    return True


if __name__ == '__main__':
    import sys
    success = set_demo_values()
    sys.exit(0 if success else 1)
