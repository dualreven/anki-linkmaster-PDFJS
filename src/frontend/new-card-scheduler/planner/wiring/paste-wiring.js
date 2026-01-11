import { isValidAnnoToken } from "../token-utils.js";

function parseAnnoIdsFromClipboardTextOrThrow(text) {
  if (typeof text !== "string") {
    throw new Error("剪贴板内容必须是字符串");
  }
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) {
    throw new Error("剪贴板内容为空，无法解析 annotation-id");
  }

  const parts = raw.split(/[;\s]+/g).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("剪贴板内容为空，无法解析 annotation-id");
  }

  const out = [];
  for (const part of parts) {
    const s = String(part).trim();
    if (!s) {
      throw new Error("剪贴板内容包含空的 annotation-id 段");
    }
    if (s.startsWith("[[") || s.endsWith("]]")) {
      if (!isValidAnnoToken(s)) {
        throw new Error(`剪贴板包含非法 token：${JSON.stringify(s)}`);
      }
      out.push(s.slice(2, -2));
      continue;
    }
    out.push(s);
  }

  return out;
}

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
        notification?.showError?.("粘贴无效：请先选中卡片，并点击该卡片的 Q 或 A 输入框设置粘贴焦点", 2500);
      } catch {
        // ignore
      }
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onPaste = async (e) => {
    const { selectedTempId } = engine.getState();
    const focus = getPasteFocus();
    if (!selectedTempId || !focus || focus.tempId !== selectedTempId || !focus.face) {
      try {
        notification?.showError?.("粘贴无效：请先选中卡片，并点击该卡片的 Q 或 A 输入框设置粘贴焦点", 2500);
      } catch {
        // ignore
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

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
      await onAfterIngestApplied?.({ annotationIds });
      render();
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
