export function parseAnnoIdsFromClipboardTextOrThrow(text) {
  if (typeof text !== "string") {
    throw new Error("剪贴板内容必须是字符串");
  }

  const raw = text;
  const parts = raw.split(";");
  const out = [];

  for (let i = 0; i < parts.length; i += 1) {
    const trimmed = parts[i].trim();
    if (!trimmed) {
      throw new Error("剪贴板内容包含空的 annotation-id 段（请检查分号分隔）");
    }
    out.push(trimmed);
  }

  if (out.length === 0) {
    throw new Error("剪贴板内容为空，无法解析 annotation-id");
  }

  return out;
}

