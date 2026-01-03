export function formatHHMM(date) {
  if (!(date instanceof Date)) {
    throw new Error("[pdf-anchor] formatHHMM requires Date");
  }
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function makePdfAnchorId(cryptoRef = crypto) {
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== "function") {
    throw new Error("[pdf-anchor] crypto.getRandomValues is required to generate anchor id");
  }
  const hex = Array.from(cryptoRef.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `pdfanchor-${hex}`;
}

export function normalizeStoredPositionToPercent(storedPosition) {
  if (storedPosition === null || storedPosition === undefined) {
    return null;
  }
  if (typeof storedPosition !== "number" || Number.isNaN(storedPosition)) {
    throw new Error("[pdf-anchor] storedPosition must be a number or null");
  }
  let raw = storedPosition;
  if (raw <= 1) {
    raw = raw * 100;
  }
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped);
}

export function normalizePercentToStoredPosition(percent) {
  if (percent === null || percent === undefined) {
    return null;
  }
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    throw new Error("[pdf-anchor] percent must be a finite number or null");
  }
  const clipped = Math.max(0, Math.min(100, percent));
  return Math.round(clipped) / 100;
}

