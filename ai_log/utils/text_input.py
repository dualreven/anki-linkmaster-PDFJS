def normalize_forum_content(content: str, multiline: bool) -> str:
    """将 forum 评论输入归一化为包含换行的字符串。"""
    if multiline:
        print("🔄 请输入多行内容（按 Ctrl+D 或输入 'EOF' 结束）：")
        lines = []
        try:
            while True:
                line = input()
                if line.strip().upper() == 'EOF':
                    break
                lines.append(line)
        except EOFError:
            pass
        return "\n".join(lines)
    return content.replace('\\n', '\n') if content else content


def split_lines_preserve(content: str) -> list:
    """把多行字符串切分为数组，单行则包装为单元素数组。"""
    if content is None:
        return []
    return content.split('\n') if '\n' in content else [content]


def read_text_from_file(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


