import { TranslatorManager } from "../core/translator-manager.js";
import { PDF_TRANSLATOR_EVENTS } from "../events.js";

describe("TranslatorManager — store driven", () => {
  test("translateText updates store and emits STARTED/COMPLETED", async () => {
    const eventBus = { emit: jest.fn() };
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const translationService = {
      getCurrentEngine: () => ({ name: "mymemory" }),
      translate: jest.fn().mockResolvedValue({
        original: "hello",
        translation: "你好",
        language: { source: "en", target: "zh" },
      }),
      setEngine: jest.fn().mockReturnValue(true),
    };

    const manager = new TranslatorManager({ eventBus, logger, translationService, targetLanguage: "zh" });

    await manager.translateText("hello", null, "auto", { pageNumber: 2, position: { x: 1, y: 2 } });

    const state = manager.store.get();
    expect(state.isTranslating).toBe(false);
    expect(state.error).toBeNull();
    expect(state.currentTranslation?.original).toBe("hello");
    expect(state.translationHistory.length).toBeGreaterThan(0);

    const emitted = eventBus.emit.mock.calls.map(([name]) => name);
    expect(emitted).toContain(PDF_TRANSLATOR_EVENTS.TRANSLATE.STARTED);
    expect(emitted).toContain(PDF_TRANSLATOR_EVENTS.TRANSLATE.COMPLETED);
  });
});

