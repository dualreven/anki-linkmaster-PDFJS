import { buildAnnoTokenOrThrow, isValidAnnoToken } from "../token-utils.js";

function ensureQASmartInputStyles() {
  const id = "qa-smart-input-styles";
  if (document.getElementById(id)) {
    return;
  }

  const style = document.createElement("style");
  style.id = id;
  style.type = "text/css";
  style.textContent = `
.qa-smart-input {
  position: relative;
  width: 100%;
}
.qa-smart-input__wrap {
  position: relative;
  width: 100%;
  min-height: 84px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}
.qa-smart-input__label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
  user-select: none;
}
.qa-smart-input__highlight,
.qa-smart-input__textarea {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 84px;
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}
.qa-smart-input__highlight {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  color: #111827;
}
.qa-smart-input__textarea {
  position: relative;
  border: none;
  outline: none;
  resize: vertical;
  background: transparent;
  color: transparent;
  caret-color: #111827;
}
.qa-smart-input__textarea::placeholder {
  color: #9ca3af;
}
.qa-smart-input__token {
  display: inline-block;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.15);
  color: #1d4ed8;
}
.qa-smart-input__token--unknown {
  background: rgba(107, 114, 128, 0.15);
  color: #374151;
}
.qa-smart-input__wrap:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
  `.trim();

  document.head.appendChild(style);
}

function normalizeText(text) {
  if (typeof text !== "string") {
    throw new Error("输入内容必须是字符串");
  }
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseAnnoIdsFromSmartInputTextOrThrow(text) {
  const raw = normalizeText(text);
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const parts = trimmed.split(/[;\s]+/g).filter(Boolean);
  const out = [];

  for (const part of parts) {
    const s = String(part).trim();
    if (!s) {
      throw new Error("输入包含空的标注ID段");
    }
    if (s.startsWith("[[") || s.endsWith("]]")) {
      if (!isValidAnnoToken(s)) {
        throw new Error(`非法 token：${JSON.stringify(s)}`);
      }
      out.push(s.slice(2, -2));
      continue;
    }
    out.push(s);
  }

  return out;
}

export function buildSmartInputTextFromAnnoIdsOrThrow(annotationIds) {
  if (!Array.isArray(annotationIds)) {
    throw new Error("annotationIds 必须为数组");
  }
  const tokens = annotationIds.map((id) => buildAnnoTokenOrThrow(id));
  return tokens.join("\n");
}

function renderHighlightOrThrow({ highlightEl, text, knownAnnoIds }) {
  if (!highlightEl) {
    throw new Error("renderHighlightOrThrow: highlightEl 必填");
  }

  const known = Array.isArray(knownAnnoIds) ? new Set(knownAnnoIds) : new Set();
  const raw = normalizeText(text);

  highlightEl.innerHTML = "";
  if (!raw) {
    return;
  }

  const tokenRe = /\[\[([^\[\]\r\n]+)\]\]/g;
  let last = 0;
  let match = null;

  while ((match = tokenRe.exec(raw)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > last) {
      highlightEl.appendChild(document.createTextNode(raw.slice(last, start)));
    }

    const id = match[1];
    const span = document.createElement("span");
    span.className = known.has(id) ? "qa-smart-input__token" : "qa-smart-input__token qa-smart-input__token--unknown";
    span.setAttribute("data-anno-id", id);
    span.textContent = `[[${id}]]`;
    highlightEl.appendChild(span);

    last = end;
  }

  if (last < raw.length) {
    highlightEl.appendChild(document.createTextNode(raw.slice(last)));
  }
}

export function createQASmartInput({
  label,
  placeholder,
  onFocus,
  onCommitAnnoIds,
  onError,
  initialText = "",
}) {
  ensureQASmartInputStyles();

  if (typeof label !== "string" || !label.trim()) {
    throw new Error("createQASmartInput: label 必须为非空字符串");
  }
  if (typeof onCommitAnnoIds !== "function") {
    throw new Error("createQASmartInput: onCommitAnnoIds 必须为函数");
  }

  const root = document.createElement("div");
  root.className = "qa-smart-input";

  const labelEl = document.createElement("div");
  labelEl.className = "qa-smart-input__label";
  labelEl.textContent = label.trim();

  const wrap = document.createElement("div");
  wrap.className = "qa-smart-input__wrap";

  const highlight = document.createElement("div");
  highlight.className = "qa-smart-input__highlight";
  highlight.setAttribute("aria-hidden", "true");

  const textarea = document.createElement("textarea");
  textarea.className = "qa-smart-input__textarea";
  textarea.spellcheck = false;
  textarea.value = typeof initialText === "string" ? initialText : "";
  textarea.placeholder = typeof placeholder === "string" ? placeholder : "";

  let lastRenderedText = textarea.value;
  let knownAnnoIds = [];

  const syncScroll = () => {
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  };

  const render = () => {
    renderHighlightOrThrow({ highlightEl: highlight, text: textarea.value, knownAnnoIds });
    lastRenderedText = textarea.value;
    syncScroll();
  };

  textarea.addEventListener("scroll", syncScroll);
  textarea.addEventListener("input", render);
  textarea.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
  textarea.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  textarea.addEventListener("focus", () => {
    try { onFocus?.(); } catch { /* ignore */ }
  });
  textarea.addEventListener("blur", () => {
    const nextText = textarea.value;
    try {
      const ids = parseAnnoIdsFromSmartInputTextOrThrow(nextText);
      onCommitAnnoIds(ids);
    } catch (e) {
      textarea.value = lastRenderedText;
      render();
      try { onError?.(e); } catch { /* ignore */ }
    }
  });

  wrap.appendChild(highlight);
  wrap.appendChild(textarea);
  root.appendChild(labelEl);
  root.appendChild(wrap);

  render();

  return {
    rootEl: root,
    textareaEl: textarea,
    setKnownAnnoIds(nextKnownAnnoIds) {
      if (!Array.isArray(nextKnownAnnoIds)) {
        throw new Error("setKnownAnnoIds: nextKnownAnnoIds 必须为数组");
      }
      knownAnnoIds = nextKnownAnnoIds.map((x) => String(x));
      render();
    },
    setText(nextText) {
      if (typeof nextText !== "string") {
        throw new Error("setText: nextText 必须为字符串");
      }
      textarea.value = nextText;
      render();
    },
    getText() {
      return textarea.value;
    },
    focus() {
      textarea.focus();
    }
  };
}
