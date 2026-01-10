export function createToastDedupeGate({ windowMs = 2000, now = () => Date.now() } = {}) {
  const ms = Number(windowMs);
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error(`createToastDedupeGate: windowMs 必须为 >=0 的数字，当前=${String(windowMs)}`);
  }
  if (typeof now !== "function") {
    throw new Error("createToastDedupeGate: now 必须为函数");
  }

  /** @type {Map<string, number>} */
  const lastAtByKey = new Map();

  const shouldToast = (key) => {
    const k = String(key || "");
    if (!k.trim()) {
      return true;
    }
    const t = Number(now());
    if (!Number.isFinite(t)) {
      return true;
    }

    const last = lastAtByKey.get(k);
    if (last === undefined) {
      lastAtByKey.set(k, t);
      return true;
    }
    if (t - last > ms) {
      lastAtByKey.set(k, t);
      return true;
    }
    return false;
  };

  return {
    shouldToast,
    reset: () => lastAtByKey.clear(),
  };
}

