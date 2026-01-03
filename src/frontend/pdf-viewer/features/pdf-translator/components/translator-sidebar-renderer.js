const STYLE = {
  settingsSection: "margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:6px;",
  label: "display:block;font-size:12px;color:#666;margin-bottom:6px;font-weight:500;",
  select: "width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;background:white;cursor:pointer;",
  resultSection: "margin-bottom:20px;padding:16px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;min-height:200px;",
  emptyCenter: "text-align:center;color:#999;padding:40px 20px;",
  emptyIcon: "font-size:48px;margin-bottom:12px;",
  emptyText: "font-size:14px;",
  emptyHint: "font-size:12px;margin-top:8px;color:#bbb;",
  boxOriginal: "padding:12px;background:#f9f9f9;border-left:3px solid #2196F3;font-size:14px;line-height:1.6;word-break:break-word;",
  boxTranslation: "padding:12px;background:#f0f7ff;border-left:3px solid #4CAF50;font-size:14px;line-height:1.6;word-break:break-word;",
  sectionTitle: "font-size:12px;color:#666;margin-bottom:6px;font-weight:500;",
  actionsRow: "display:flex;gap:8px;flex-wrap:wrap;",
  historySection: "margin-bottom:16px;",
  historyHeader: "display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;user-select:none;",
  historyTitle: "font-size:14px;font-weight:500;color:#333;",
  toggleIcon: "font-size:12px;color:#666;",
  historyList: "max-height:300px;overflow-y:auto;margin-top:8px;",
  historyEmpty: "text-align:center;color:#999;font-size:13px;padding:20px;",
  historyItem: "padding:10px;margin-bottom:8px;background:#f9f9f9;border-radius:4px;cursor:pointer;transition:background 0.2s;",
  historyItemTitle: "font-size:13px;color:#333;margin-bottom:4px;font-weight:500;",
  historyItemSub: "font-size:12px;color:#666;",
  historyItemTime: "font-size:11px;color:#999;margin-top:4px;",
  errorCenter: "text-align:center;color:#f44336;padding:40px 20px;"
};

function assertString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`[TranslatorSidebarUI] ${label} must be a string`);
  }
}

function escapeHtml(text) {
  assertString(text, "escapeHtml(text)");
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderActionButton({ className, label, bg, hoverBg, flex = true }) {
  assertString(className, "action.className");
  assertString(label, "action.label");
  assertString(bg, "action.bg");
  assertString(hoverBg, "action.hoverBg");

  const flexStyle = flex ? "flex:1;min-width:100px;" : "";
  const baseStyle =
    `${flexStyle}` +
    `padding:8px 16px;background:${bg};color:white;border:none;border-radius:4px;` +
    "font-size:13px;cursor:pointer;transition:background 0.2s;";

  return (
    `<button class="translator-action-btn ${className}" style="${baseStyle}" ` +
    `onmouseover="this.style.background='${hoverBg}'" ` +
    `onmouseout="this.style.background='${bg}'">` +
    `${label}</button>`
  );
}

function renderTranslationResultHtml(translation) {
  const original = translation?.original;
  const translated = translation?.translation;
  assertString(original, "translation.original");
  assertString(translated, "translation.translation");

  const actions = [
    { className: "translator-create-annotation-btn", label: "📌 制作标注", bg: "#9C27B0", hoverBg: "#7B1FA2" },
    { className: "translator-create-card-btn", label: "📇 制作卡片", bg: "#2196F3", hoverBg: "#1976D2" },
    { className: "translator-copy-btn", label: "📋 复制译文", bg: "#4CAF50", hoverBg: "#388E3C" },
    { className: "translator-speak-btn", label: "🔊 朗读", bg: "#FF9800", hoverBg: "#F57C00", flex: false }
  ];

  return (
    "<div class=\"translation-content\">" +
    "<div style=\"margin-bottom:16px;\">" +
    `<div style="${STYLE.sectionTitle}">原文</div>` +
    `<div style="${STYLE.boxOriginal}">${escapeHtml(original)}</div>` +
    "</div>" +
    "<div style=\"margin-bottom:16px;\">" +
    `<div style="${STYLE.sectionTitle}">译文</div>` +
    `<div style="${STYLE.boxTranslation}">${escapeHtml(translated)}</div>` +
    "</div>" +
    `<div style="${STYLE.actionsRow}">${actions.map(renderActionButton).join("")}</div>` +
    "</div>"
  );
}

function renderHistoryItemHtml(item, index) {
  const original = item?.original;
  const translated = item?.translation;
  assertString(original, "historyItem.original");
  assertString(translated, "historyItem.translation");

  const title = original.length > 30 ? `${original.substring(0, 30)}...` : original;
  const sub = translated.length > 40 ? `${translated.substring(0, 40)}...` : translated;
  const time = new Date(item.timestamp).toLocaleTimeString("zh-CN");

  return (
    `<div class="history-item" style="${STYLE.historyItem}" ` +
    "onmouseover=\"this.style.background='#f0f0f0'\" " +
    "onmouseout=\"this.style.background='#f9f9f9'\" " +
    `data-index="${index}">` +
    `<div style="${STYLE.historyItemTitle}">${escapeHtml(title)}</div>` +
    `<div style="${STYLE.historyItemSub}">${escapeHtml(sub)}</div>` +
    `<div style="${STYLE.historyItemTime}">${escapeHtml(time)}</div>` +
    "</div>"
  );
}

function createSettingsSection({ onEngineChanged }) {
  if (typeof onEngineChanged !== "function") {
    throw new Error("[TranslatorSidebarUI] createSettingsSection: onEngineChanged must be a function");
  }

  const section = document.createElement("div");
  section.className = "translator-settings";
  section.style.cssText = STYLE.settingsSection;

  const label = document.createElement("label");
  label.style.cssText = STYLE.label;
  label.textContent = "翻译引擎";

  const select = document.createElement("select");
  select.style.cssText = STYLE.select;
  select.innerHTML = [
    "<option value=\"deepl\">DeepL (推荐)</option>",
    "<option value=\"google\">Google Translate</option>",
    "<option value=\"local\" disabled>本地词典 (即将支持)</option>"
  ].join("");
  select.addEventListener("change", (e) => onEngineChanged(e.target.value));

  section.appendChild(label);
  section.appendChild(select);
  return section;
}

function createTranslationSection({ currentTranslation }) {
  const section = document.createElement("div");
  section.className = "translator-result";
  section.id = "translator-result-section";
  section.style.cssText = STYLE.resultSection;

  if (currentTranslation) {
    section.innerHTML = renderTranslationResultHtml(currentTranslation);
    return section;
  }

  section.innerHTML = [
    `<div style="${STYLE.emptyCenter}">`,
    `<div style="${STYLE.emptyIcon}">🌐</div>`,
    `<div style="${STYLE.emptyText}">选中文本即可自动翻译</div>`,
    `<div style="${STYLE.emptyHint}">最少选中 3 个字符</div>`,
    "</div>"
  ].join("");
  return section;
}

function createHistorySection({ translationHistory }) {
  if (!Array.isArray(translationHistory)) {
    throw new Error("[TranslatorSidebarUI] createHistorySection: translationHistory must be an array");
  }

  const section = document.createElement("div");
  section.className = "translator-history";
  section.style.cssText = STYLE.historySection;

  const header = document.createElement("div");
  header.style.cssText = STYLE.historyHeader;

  const title = document.createElement("div");
  title.style.cssText = STYLE.historyTitle;
  title.textContent = `📚 翻译历史 (${translationHistory.length})`;

  const toggleIcon = document.createElement("span");
  toggleIcon.textContent = "▾";
  toggleIcon.style.cssText = STYLE.toggleIcon;

  header.appendChild(title);
  header.appendChild(toggleIcon);

  const listContainer = document.createElement("div");
  listContainer.className = "translator-history-list";
  listContainer.style.cssText = STYLE.historyList;

  if (translationHistory.length === 0) {
    listContainer.innerHTML = `<div style="${STYLE.historyEmpty}">暂无翻译历史</div>`;
  } else {
    listContainer.innerHTML = translationHistory.map(renderHistoryItemHtml).join("");
  }

  header.addEventListener("click", () => {
    const isHidden = listContainer.style.display === "none";
    listContainer.style.display = isHidden ? "block" : "none";
    toggleIcon.textContent = isHidden ? "▾" : "▸";
  });

  section.appendChild(header);
  section.appendChild(listContainer);
  return section;
}

export function renderTranslatorSidebar({ rootElement, translationHistory, currentTranslation, onEngineChanged }) {
  if (!(rootElement instanceof HTMLElement)) {
    throw new Error("[TranslatorSidebarUI] renderTranslatorSidebar: rootElement must be an HTMLElement");
  }

  rootElement.innerHTML = "";
  rootElement.appendChild(createSettingsSection({ onEngineChanged }));
  rootElement.appendChild(createTranslationSection({ currentTranslation }));
  rootElement.appendChild(createHistorySection({ translationHistory }));
}

export function renderTranslatorError({ rootElement, errorMessage }) {
  if (!(rootElement instanceof HTMLElement)) {
    throw new Error("[TranslatorSidebarUI] renderTranslatorError: rootElement must be an HTMLElement");
  }
  assertString(errorMessage, "errorMessage");

  const resultSection = rootElement.querySelector("#translator-result-section");
  if (!resultSection) {return;}

  const safeMessage = escapeHtml(errorMessage);
  resultSection.innerHTML = [
    `<div style="${STYLE.errorCenter}">`,
    `<div style="${STYLE.emptyIcon}">⚠️</div>`,
    "<div style=\"font-size:14px;font-weight:500;\">翻译失败</div>",
    `<div style="font-size:12px;margin-top:8px;color:#999;">${safeMessage}</div>`,
    "</div>"
  ].join("");
}
