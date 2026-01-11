import { buildSmartInputTextFromAnnoIdsOrThrow, createQASmartInput } from "./qa-smart-input.js";

function createButton({ text, title = "", className = "", onClick }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className || "btn";
  btn.textContent = text;
  if (title) {
    btn.title = title;
  }
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  return btn;
}

function createCardRow({
  engine,
  notification,
  card,
  draftCard,
  index,
  selectedTempId,
  metaPreview,
  onSelect,
  onRename,
  onDelete,
  onReorder,
  onSetPasteFocus,
  onRender,
}) {
  const row = document.createElement("div");
  row.className = "pdf-row";
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "8px";
  row.style.padding = "8px";
  row.style.border = "1px solid #eee";
  row.style.borderRadius = "8px";
  row.style.background = card.tempId === selectedTempId ? "#fff9e6" : "#fff";

  row.setAttribute("data-temp-id", card.tempId);
  row.setAttribute("data-index", String(index));

  // Drag handle
  const dragHandle = document.createElement("div");
  dragHandle.textContent = "⋮⋮";
  dragHandle.title = "拖拽排序";
  dragHandle.style.cursor = "grab";
  dragHandle.style.userSelect = "none";
  dragHandle.style.padding = "0 6px";
  dragHandle.setAttribute("draggable", "true");

  dragHandle.addEventListener("dragstart", (e) => {
    try {
      e.dataTransfer?.setData?.("text/plain", String(index));
      e.dataTransfer.dropEffect = "move";
    } catch {
      // ignore
    }
  });

  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch { /* ignore */ }
  });

  row.addEventListener("drop", (e) => {
    e.preventDefault();
    let fromIndex = null;
    try {
      const raw = e.dataTransfer?.getData?.("text/plain");
      if (raw !== undefined && raw !== null && String(raw).trim()) {
        fromIndex = Number(String(raw));
      }
    } catch {
      // ignore
    }
    if (!Number.isInteger(fromIndex)) {
      return;
    }
    onReorder(fromIndex, index);
  });

  // Select area
  const selectArea = document.createElement("div");
  selectArea.style.flex = "1";
  selectArea.style.display = "flex";
  selectArea.style.flexDirection = "column";
  selectArea.style.gap = "6px";
  selectArea.style.cursor = "pointer";
  selectArea.addEventListener("click", () => onSelect(card.tempId));

  const titleRow = document.createElement("div");
  titleRow.style.display = "flex";
  titleRow.style.alignItems = "center";
  titleRow.style.gap = "8px";

  const idxLabel = document.createElement("div");
  idxLabel.textContent = `#${index + 1}`;
  idxLabel.style.fontFamily = "monospace";
  idxLabel.style.color = "#666";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "卡片标题（可选）";
  titleInput.value = card.title || "";
  titleInput.style.flex = "1";
  titleInput.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(card.tempId);
  });
  titleInput.addEventListener("input", () => onRename(card.tempId, titleInput.value));

  titleRow.appendChild(idxLabel);
  titleRow.appendChild(titleInput);

  const facesRow = document.createElement("div");
  facesRow.style.display = "flex";
  facesRow.style.gap = "8px";
  // 兼容旧测试：保留 Q/A 按钮节点，但不在 UI 上展示（用户不希望看到按钮）。
  facesRow.style.display = "none";

  const qBtn = createButton({
    text: `Q (${card.QCount})`,
    title: "点击设置粘贴焦点：Q",
    className: "btn",
    onClick: () => onSetPasteFocus(card.tempId, "Q")
  });

  const aBtn = createButton({
    text: `A (${card.ACount})`,
    title: "点击设置粘贴焦点：A",
    className: "btn",
    onClick: () => onSetPasteFocus(card.tempId, "A")
  });

  facesRow.appendChild(qBtn);
  facesRow.appendChild(aBtn);

  const metaRow = document.createElement("div");
  metaRow.style.fontSize = "12px";
  metaRow.style.color = "#666";
  metaRow.style.display = "flex";
  metaRow.style.gap = "8px";

  const qMeta = Array.isArray(metaPreview?.Q) ? metaPreview.Q : [];
  const aMeta = Array.isArray(metaPreview?.A) ? metaPreview.A : [];

  const formatMeta = (m) => {
    const id = typeof m?.id === "string" ? m.id : "";
    const title = typeof m?.title === "string" ? m.title : "";
    const type = typeof m?.type === "string" ? m.type : "";
    const label = title.trim() ? title.trim() : id.trim();
    if (!label) {
      return "";
    }
    return `${label} (${type.trim() ? type.trim() : "unknown"})`;
  };

  const qMetaText = qMeta.slice(0, 3).map(formatMeta).filter(Boolean).join(" / ");
  const aMetaText = aMeta.slice(0, 3).map(formatMeta).filter(Boolean).join(" / ");

  const qMetaEl = document.createElement("div");
  qMetaEl.textContent = qMetaText ? `Q: ${qMetaText}` : "Q: （无元信息）";
  const aMetaEl = document.createElement("div");
  aMetaEl.textContent = aMetaText ? `A: ${aMetaText}` : "A: （无元信息）";

  metaRow.appendChild(qMetaEl);
  metaRow.appendChild(aMetaEl);

  selectArea.appendChild(titleRow);
  selectArea.appendChild(facesRow);
  selectArea.appendChild(metaRow);

  const editorRow = document.createElement("div");
  editorRow.style.display = "flex";
  editorRow.style.gap = "10px";
  editorRow.style.marginTop = "6px";

  const qKnown = Array.isArray(metaPreview?.Q)
    ? metaPreview.Q.filter((m) => String(m?.type || "") !== "unknown").map((m) => String(m?.id || "")).filter(Boolean)
    : [];
  const aKnown = Array.isArray(metaPreview?.A)
    ? metaPreview.A.filter((m) => String(m?.type || "") !== "unknown").map((m) => String(m?.id || "")).filter(Boolean)
    : [];

  const qText = buildSmartInputTextFromAnnoIdsOrThrow(Array.isArray(draftCard?.Q) ? draftCard.Q : []);
  const aText = buildSmartInputTextFromAnnoIdsOrThrow(Array.isArray(draftCard?.A) ? draftCard.A : []);

  const qInput = createQASmartInput({
    label: "Q",
    placeholder: "粘贴/输入：ann_1 ann_2 或 [[ann_1]]",
    initialText: qText,
    onFocus: () => {
      onSetPasteFocus(card.tempId, "Q", { silent: true, noRender: true });
    },
    onCommitAnnoIds: (annotationIds) => {
      if (!engine || typeof engine.replaceCardFaceAnnotationIdsOrThrow !== "function") {
        throw new Error("Q 输入提交失败：engine.replaceCardFaceAnnotationIdsOrThrow 缺失");
      }
      engine.replaceCardFaceAnnotationIdsOrThrow({ tempId: card.tempId, face: "Q", annotationIds });
      onRender?.();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      notification?.showError?.(`Q 输入无效：${msg}`, 3000);
    }
  });
  qInput.setKnownAnnoIds(qKnown);
  qInput.textareaEl.setAttribute("data-face", "Q");
  qInput.textareaEl.setAttribute("data-testid", "qa-smart-textarea-Q");

  const aInput = createQASmartInput({
    label: "A",
    placeholder: "粘贴/输入：ann_1 ann_2 或 [[ann_1]]",
    initialText: aText,
    onFocus: () => {
      onSetPasteFocus(card.tempId, "A", { silent: true, noRender: true });
    },
    onCommitAnnoIds: (annotationIds) => {
      if (!engine || typeof engine.replaceCardFaceAnnotationIdsOrThrow !== "function") {
        throw new Error("A 输入提交失败：engine.replaceCardFaceAnnotationIdsOrThrow 缺失");
      }
      engine.replaceCardFaceAnnotationIdsOrThrow({ tempId: card.tempId, face: "A", annotationIds });
      onRender?.();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      notification?.showError?.(`A 输入无效：${msg}`, 3000);
    }
  });
  aInput.setKnownAnnoIds(aKnown);
  aInput.textareaEl.setAttribute("data-face", "A");
  aInput.textareaEl.setAttribute("data-testid", "qa-smart-textarea-A");

  editorRow.appendChild(qInput.rootEl);
  editorRow.appendChild(aInput.rootEl);
  selectArea.appendChild(editorRow);

  const deleteBtn = createButton({
    text: "删除",
    title: "删除该草稿卡",
    className: "btn",
    onClick: () => onDelete(card.tempId)
  });

  row.appendChild(dragHandle);
  row.appendChild(selectArea);
  row.appendChild(deleteBtn);

  return row;
}

export function createPlannerWorkspaceUI({ root, engine, getCardMetaPreview, notification }) {
  const state = {
    disposed: false,
    selectedTempId: null,
    pasteFocus: null,
  };

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "8px";

  const left = document.createElement("div");
  left.textContent = "草稿卡列表（拖拽排序 / 点击 Q/A 输入框后 Ctrl+V 粘贴）";
  left.style.fontWeight = "600";

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";

  const btnSelectNone = createButton({
    text: "取消选中",
    title: "清空选中与粘贴焦点",
    className: "btn",
    onClick: () => {
      engine.setSelected(null);
      state.pasteFocus = null;
      render();
    }
  });

  const btnCreateEmpty = createButton({
    text: "新建空卡",
    title: "创建一张空草稿卡并选中",
    className: "btn",
    onClick: () => {
      const tempId = engine.createEmptyCardOrThrow();
      state.pasteFocus = null;
      render();
      notification?.showInfo?.(`已创建空卡：tempId=${tempId}`, 1200);
    }
  });

  const btnResetDraftCards = createButton({
    text: "清空草稿卡",
    title: "清空所有草稿卡并清空选中/粘贴焦点",
    className: "btn",
    onClick: () => {
      engine.resetDraftCardsOrThrow();
      state.pasteFocus = null;
      render();
      notification?.showInfo?.("已清空草稿卡", 1200);
    }
  });

  right.appendChild(btnSelectNone);
  right.appendChild(btnCreateEmpty);
  right.appendChild(btnResetDraftCards);
  header.appendChild(left);
  header.appendChild(right);

  const list = document.createElement("div");
  list.setAttribute("data-testid", "draft-card-list");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "10px";

  root.innerHTML = "";
  root.appendChild(header);
  root.appendChild(list);

  function setPasteFocus(tempId, face, { silent = false, noRender = false } = {}) {
    if (state.disposed) {
      return;
    }
    engine.setSelected(tempId);
    state.pasteFocus = { tempId, face };
    if (!silent) {
      try {
        notification?.showInfo?.(`已设置粘贴焦点：${face}（tempId=${tempId}）`, 1200);
      } catch {
        // ignore
      }
    }
    if (!noRender) {
      render();
    }
  }

  function render() {
    if (state.disposed) {
      return;
    }
    const cards = engine.getCardsForView();
    const snapshot = engine.getDraftCardsSnapshotOrThrow();
    const byTempId = new Map(snapshot.map((c) => [c.tempId, c]));
    const { selectedTempId } = engine.getState();
    state.selectedTempId = selectedTempId;

    list.innerHTML = "";

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const draftCard = byTempId.get(card.tempId) || { tempId: card.tempId, title: card.title, Q: [], A: [] };
      const metaPreview = typeof getCardMetaPreview === "function"
        ? getCardMetaPreview(card.tempId)
        : null;
      const row = createCardRow({
        engine,
        notification,
        card,
        draftCard,
        index: i,
        selectedTempId,
        metaPreview,
        onSelect: (tempId) => {
          engine.setSelected(tempId);
          render();
        },
        onRename: (tempId, title) => {
          engine.renameCard(tempId, title);
        },
        onDelete: (tempId) => {
          engine.deleteCard(tempId);
          state.pasteFocus = null;
          render();
        },
        onReorder: (fromIndex, toIndex) => {
          engine.reorderCards(fromIndex, toIndex);
          render();
        },
        onSetPasteFocus: setPasteFocus,
        onRender: () => render(),
      });
      list.appendChild(row);
    }
  }

  render();

  return {
    render,
    getPasteFocus: () => state.pasteFocus,
    setPasteFocus,
    dispose() {
      state.disposed = true;
      root.innerHTML = "";
    }
  };
}
