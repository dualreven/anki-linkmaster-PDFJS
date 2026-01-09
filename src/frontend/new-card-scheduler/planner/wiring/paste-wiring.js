import { parseAnnoIdsFromClipboardTextOrThrow } from "../clipboard-parse.js";

function isCtrlV(e) {
  if (!e) {
    return false;
  }
  const key = String(e.key || "").toLowerCase();
  const isModifier = e.ctrlKey === true || e.metaKey === true;
  return isModifier && key === "v";
}

export function installPasteWiring({ engine, getPasteFocus, render, notification, onAfterIngestApplied = null }) {
  if (!engine) {
    throw new Error("installPasteWiring: engine 必填");
  }
  if (typeof getPasteFocus !== "function") {
    throw new Error("installPasteWiring: getPasteFocus 必须为函数");
  }
  if (typeof render !== "function") {
    throw new Error("installPasteWiring: render 必须为函数");
  }
  if (onAfterIngestApplied !== null && typeof onAfterIngestApplied !== "function") {
    throw new Error("installPasteWiring: onAfterIngestApplied 必须为函数或 null");
  }

  const onKeyDown = (e) => {
    if (!isCtrlV(e)) {
      return;
    }
    const { selectedTempId } = engine.getState();
    const focus = getPasteFocus();
    if (!selectedTempId || !focus || focus.tempId !== selectedTempId || !focus.face) {
      try {
        notification?.showError?.("粘贴无效：请先选中卡片，并点击该卡片的 Q 或 A 设置粘贴焦点", 2500);
      } catch {
        // ignore
      }
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onPaste = (e) => {
    const { selectedTempId } = engine.getState();
    const focus = getPasteFocus();
    if (!selectedTempId || !focus || focus.tempId !== selectedTempId || !focus.face) {
      try {
        notification?.showError?.("粘贴无效：请先选中卡片，并点击该卡片的 Q 或 A 设置粘贴焦点", 2500);
      } catch {
        // ignore
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    let text = "";
    try {
      text = e.clipboardData?.getData?.("text/plain") || "";
    } catch {
      text = "";
    }

    try {
      const annotationIds = parseAnnoIdsFromClipboardTextOrThrow(text);
      engine.dispatchIngest({
        op: {
          kind: "all-to-one",
          target: { kind: "card-id", tempId: selectedTempId },
          face: focus.face,
        },
        annotationIds
      });
      render();
      try {
        // eslint-disable-next-line no-use-before-define
        onAfterIngestApplied?.({ tempId: selectedTempId, face: focus.face, annotationIds });
      } catch {
        // ignore
      }
      try {
        notification?.showInfo?.(`已追加 ${annotationIds.length} 个标注到 ${focus.face}`, 1500);
      } catch {
        // ignore
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        notification?.showError?.(`粘贴失败：${message}`, 3000);
      } catch {
        // ignore
      }
    }
  };

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("paste", onPaste, true);

  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("paste", onPaste, true);
  };
}
