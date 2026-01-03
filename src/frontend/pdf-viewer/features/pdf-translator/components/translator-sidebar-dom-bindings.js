export function bindTranslatorSidebarDom({ rootElement, currentTranslation, translationHistory, actions, onSelectHistoryIndex }) {
  if (!(rootElement instanceof HTMLElement)) {
    throw new Error("[TranslatorSidebarUI] bindTranslatorSidebarDom: rootElement must be an HTMLElement");
  }
  if (!Array.isArray(translationHistory)) {
    throw new Error("[TranslatorSidebarUI] bindTranslatorSidebarDom: translationHistory must be an array");
  }
  if (!actions) {
    throw new Error("[TranslatorSidebarUI] bindTranslatorSidebarDom: actions is required");
  }
  if (typeof onSelectHistoryIndex !== "function") {
    throw new Error("[TranslatorSidebarUI] bindTranslatorSidebarDom: onSelectHistoryIndex must be a function");
  }

  const bindClick = (selector, onClick) => {
    const element = rootElement.querySelector(selector);
    if (!element) {return;}
    element.addEventListener("click", onClick);
  };

  if (currentTranslation) {
    bindClick(".translator-create-annotation-btn", () => actions.createAnnotationFromTranslation(currentTranslation));
    bindClick(".translator-create-card-btn", () => actions.createCardFromTranslation(currentTranslation));
    bindClick(".translator-copy-btn", () => actions.copyTranslation(currentTranslation.translation));
    bindClick(".translator-speak-btn", () => actions.speak(currentTranslation.original));
  }

  rootElement.querySelectorAll(".history-item").forEach((element) => {
    element.addEventListener("click", (e) => {
      const idx = Number.parseInt(e.currentTarget?.dataset?.index, 10);
      if (!Number.isFinite(idx)) {return;}
      if (!translationHistory[idx]) {return;}
      onSelectHistoryIndex(idx);
    });
  });
}

