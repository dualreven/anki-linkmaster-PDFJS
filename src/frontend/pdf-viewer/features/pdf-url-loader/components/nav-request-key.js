function assertAllowedValue(name, value) {
  if (value === null || value === undefined) {
    return;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return;
  }
  throw new Error(`[url-navigation] invalid ${name}: must be a primitive (string/number/boolean) or null`);
}

function normalizeNumberOrNull(name, value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`[url-navigation] invalid ${name}: must be a number or null`);
  }
  return value;
}

export function buildNavigationRequestKey(params) {
  if (!params || typeof params !== "object") {
    throw new Error("[url-navigation] params must be an object");
  }

  assertAllowedValue("pdfId", params.pdfId ?? null);
  assertAllowedValue("anchorId", params.anchorId ?? null);
  assertAllowedValue("annotationId", params.annotationId ?? null);
  assertAllowedValue("outlineItemId", params.outlineItemId ?? null);

  const pageAt = normalizeNumberOrNull("pageAt", params.pageAt);
  const position = normalizeNumberOrNull("position", params.position ?? null);

  return [
    `pdfId=${params.pdfId ?? ""}`,
    `anchorId=${params.anchorId ?? ""}`,
    `annotationId=${params.annotationId ?? ""}`,
    `outlineItemId=${params.outlineItemId ?? ""}`,
    `pageAt=${pageAt ?? ""}`,
    `position=${position ?? ""}`,
  ].join("|");
}

