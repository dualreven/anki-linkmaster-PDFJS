import { ObservableState } from "../../../../common/utils/observable.js";
import { PDF_TRANSLATOR_EVENTS } from "../events.js";
import { prependTranslationHistory } from "../components/translator-history.js";

export class TranslatorManager {
  /** @type {import("../../../../common/utils/logger.js").Logger} */
  #logger;

  /** @type {EventBus|null} */
  #eventBus;

  /** @type {import("../services/TranslationService.js").TranslationService} */
  #translationService;

  /** @type {ObservableState} */
  store;

  constructor({ eventBus, logger, translationService, targetLanguage = "zh" }) {
    if (!translationService) {
      throw new Error("[TranslatorManager] translationService is required");
    }
    if (!logger) {
      throw new Error("[TranslatorManager] logger is required");
    }

    this.#eventBus = eventBus || null;
    this.#logger = logger;
    this.#translationService = translationService;

    const currentEngine = this.#translationService.getCurrentEngine?.()?.name || null;

    this.store = new ObservableState({
      engine: currentEngine,
      targetLanguage,
      isTranslating: false,
      error: null,
      currentTranslation: null,
      translationHistory: [],
      autoEnabled: false,
    }, {
      name: "TranslatorStore",
      logger: this.#logger
    });
  }

  setAutoEnabled(enabled) {
    if (typeof enabled !== "boolean") {
      throw new Error("[TranslatorManager] setAutoEnabled: enabled must be boolean");
    }
    this.store.set({ autoEnabled: enabled });
  }

  setEngine(engineName) {
    if (typeof engineName !== "string" || !engineName.trim()) {
      throw new Error("[TranslatorManager] setEngine: engineName must be a non-empty string");
    }
    const ok = this.#translationService.setEngine(engineName);
    if (!ok) {
      this.#logger.warn("[TranslatorManager] engine not found", { engine: engineName });
      return false;
    }
    this.store.set({ engine: engineName });
    return true;
  }

  setTargetLanguage(lang) {
    if (typeof lang !== "string" || !lang.trim()) {
      throw new Error("[TranslatorManager] setTargetLanguage: lang must be a non-empty string");
    }
    this.store.set({ targetLanguage: lang });
  }

  /**
   * 执行翻译，并更新 store（UI 订阅 store 驱动渲染）
   */
  async translateText(text, targetLang, sourceLang = "auto", context = {}) {
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("[TranslatorManager] translateText: text must be a non-empty string");
    }

    const state = this.store.get();
    const target = (typeof targetLang === "string" && targetLang.trim()) ? targetLang : state.targetLanguage;

    this.store.set({ isTranslating: true, error: null });
    try {
      this.#eventBus?.emit?.(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.STARTED,
        { text, targetLang: target, sourceLang, ...context },
        { actorId: "TranslatorManager" }
      );

      const result = await this.#translationService.translate(text, target, sourceLang);

      const payload = { ...result, ...context };
      const latest = this.store.get();
      const next = prependTranslationHistory(latest.translationHistory, payload);

      this.store.set({
        isTranslating: false,
        error: null,
        currentTranslation: next.currentTranslation,
        translationHistory: next.history,
      });

      this.#eventBus?.emit?.(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.COMPLETED,
        payload,
        { actorId: "TranslatorManager" }
      );
    } catch (e) {
      const msg = e?.message ? String(e.message) : String(e);
      this.store.set({ isTranslating: false, error: msg });
      this.#eventBus?.emit?.(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.FAILED,
        { text, targetLang: target, sourceLang, error: msg, ...context },
        { actorId: "TranslatorManager" }
      );
      throw e;
    }
  }

  clearError() {
    this.store.set({ error: null });
  }

  destroy() {
    this.#eventBus = null;
    this.#translationService = null;
  }
}
