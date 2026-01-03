export function isValidAnnoToken(token) {
  if (typeof token !== "string") {
    return false;
  }
  if (!token.startsWith("[[") || !token.endsWith("]]")) {
    return false;
  }

  if (token.includes("\n") || token.includes("\r")) {
    return false;
  }

  const inner = token.slice(2, -2);
  if (!inner) {
    return false;
  }

  // Fail-fast：token 内部不允许出现 "]]"，否则无法解析结束符
  if (inner.includes("]]")) {
    return false;
  }

  return true;
}

export function buildAnnoTokenOrThrow(annotationId) {
  const id = typeof annotationId === "string" ? annotationId : "";
  const trimmed = id.trim();
  if (!trimmed) {
    throw new Error("annotationId 不能为空");
  }
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    throw new Error("annotationId 不允许包含换行");
  }
  if (trimmed.includes("]]")) {
    throw new Error("annotationId 不允许包含子串 ']]'");
  }
  return `[[${trimmed}]]`;
}

