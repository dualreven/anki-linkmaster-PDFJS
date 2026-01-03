export const DEFAULT_TRANSLATION_HISTORY_MAX = 50;

export function prependTranslationHistory(history, data, options = {}) {
  if (!Array.isArray(history)) {
    throw new Error("[TranslatorSidebarUI] prependTranslationHistory: history must be an array");
  }
  if (!data || typeof data !== "object") {
    throw new Error("[TranslatorSidebarUI] prependTranslationHistory: data must be an object");
  }

  const nowFn = options.now ?? Date.now;
  if (typeof nowFn !== "function") {
    throw new Error("[TranslatorSidebarUI] prependTranslationHistory: options.now must be a function");
  }

  const max = options.max ?? DEFAULT_TRANSLATION_HISTORY_MAX;
  if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) {
    throw new Error("[TranslatorSidebarUI] prependTranslationHistory: options.max must be a positive number");
  }

  const timestamp = nowFn();
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new Error("[TranslatorSidebarUI] prependTranslationHistory: now() must return a number");
  }

  const nextHistory = [{ ...data, timestamp }, ...history].slice(0, max);
  return { currentTranslation: data, history: nextHistory };
}

