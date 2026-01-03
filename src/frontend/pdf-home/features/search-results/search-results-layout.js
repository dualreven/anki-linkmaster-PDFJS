export function createSearchResultsLayoutController({ logger, preferenceKey, getResultsContainer }) {
  let layoutButtons = [];
  let currentLayout = "single";

  function updateLayoutButtonsState() {
    if (!layoutButtons.length) {
      return;
    }
    layoutButtons.forEach((button) => {
      const layout = button.getAttribute("data-layout");
      if (!layout) {
        throw new Error("[search-results-layout] layout button missing data-layout");
      }
      if (layout === currentLayout) {
        button.classList.add("is-active");
      } else {
        button.classList.remove("is-active");
      }
    });
  }

  function applyLayout(layout, { persist = true } = {}) {
    const allowed = ["single", "double", "triple"];
    const targetLayout = allowed.includes(layout) ? layout : "single";
    currentLayout = targetLayout;

    const container = getResultsContainer();
    if (!container) {
      throw new Error("[search-results-layout] results container not ready");
    }

    container.classList.remove("layout-single", "layout-double", "layout-triple");
    container.classList.add("layout-" + targetLayout);

    updateLayoutButtonsState();

    if (persist) {
      window.localStorage.setItem(preferenceKey, targetLayout);
    }

    logger.debug("[search-results-layout] applied", { layout: targetLayout });
  }

  function bindLayoutButtons(container) {
    layoutButtons = Array.from(container.querySelectorAll("[data-layout]")) || [];
    layoutButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const layout = button.getAttribute("data-layout");
        applyLayout(layout);
      });
    });
    updateLayoutButtonsState();
  }

  function restoreLayoutPreference() {
    const stored = window.localStorage.getItem(preferenceKey);
    applyLayout(stored || currentLayout, { persist: false });
  }

  return {
    bindLayoutButtons,
    restoreLayoutPreference,
    applyLayout,
    updateLayoutButtonsState,
    getCurrentLayout: () => currentLayout,
  };
}

