/**
 * 说明（详细）：`docs/standards/annotation-manager.md`
 */

export function computePositionFromPercent(positionPercent, pageWidth, pageHeight) {
  const xPercent = Number(positionPercent?.xPercent ?? 0);
  const yPercent = Number(positionPercent?.yPercent ?? 0);
  const x = Math.max(0, Math.round((xPercent / 100) * (pageWidth || 1)));
  const y = Math.max(0, Math.round((yPercent / 100) * (pageHeight || 1)));
  return { x, y };
}

