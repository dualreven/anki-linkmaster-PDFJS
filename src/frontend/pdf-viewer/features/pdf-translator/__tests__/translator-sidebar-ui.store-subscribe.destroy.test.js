/* @jest-environment jsdom */

jest.mock("../../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock("../../../shared/sidebar-shell.js", () => ({
  createSidebarRoot: () => {
    const el = global.document.createElement("div");
    global.document.body.appendChild(el);
    return el;
  }
}));

jest.mock("../components/translator-sidebar-renderer.js", () => ({
  renderTranslatorSidebar: jest.fn(),
  renderTranslatorError: jest.fn(),
}));

jest.mock("../components/translator-sidebar-dom-bindings.js", () => ({
  bindTranslatorSidebarDom: jest.fn(),
}));

jest.mock("../components/translator-sidebar-actions.js", () => ({
  createTranslatorSidebarActions: () => ({})
}));

import { ObservableState } from "../../../../common/utils/observable.js";
import { TranslatorSidebarUI } from "../components/TranslatorSidebarUI.js";

describe("TranslatorSidebarUI — store.subscribe + destroy cleanup", () => {
  test("initialize subscribes store; destroy unsubscribes and stops rendering", () => {
    const eventBus = { on: jest.fn(), emit: jest.fn(), emitGlobal: jest.fn() };
    const store = new ObservableState({
      currentTranslation: null,
      translationHistory: [],
      error: null,
    }, { name: "TranslatorStoreTest", logger: console });

    const manager = { store };

    const ui = new TranslatorSidebarUI(eventBus, { manager, getCurrentPageNumber: () => 1 });
    ui.initialize();

    store.set({ currentTranslation: { original: "a", translation: "A" } });
    const { renderTranslatorSidebar } = require("../components/translator-sidebar-renderer.js");
    expect(renderTranslatorSidebar).toHaveBeenCalled();

    ui.destroy();

    const callsBefore = renderTranslatorSidebar.mock.calls.length;
    store.set({ currentTranslation: { original: "b", translation: "B" } });
    expect(renderTranslatorSidebar.mock.calls.length).toBe(callsBefore);
  });
});
