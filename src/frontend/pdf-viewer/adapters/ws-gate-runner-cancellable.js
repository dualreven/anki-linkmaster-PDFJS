/* eslint-disable custom/event-name-format */
import { validateGateConfig } from "../../common/ws/ws-gate-utils.js";
import { markEventFired } from "../utils/event-gate-runner.js";

class GateCancelledError extends Error {
  constructor(message) {
    super(message || "[ws-gate] cancelled");
    this.name = "GateCancelledError";
  }
}

export function isGateCancelledError(error) {
  return !!error && (error.name === "GateCancelledError");
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new GateCancelledError("[ws-gate] cancelled");
  }
}

/**
 * @typedef {import("../../common/event/event-bus.js").EventBus} EventBus
 */

/**
 * 等待 gate 条件满足后执行回调（支持 AbortSignal 取消）。
 *
 * @param {Object} options
 * @param {EventBus} options.eventBus
 * @param {{ events: Record<string, {fired:boolean,count:number,lastPayload:any,lastAt:number}> }} options.store
 * @param {unknown} options.rawGate
 * @param {(payload:any)=>Promise<void>|void} options.run
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<void>}
 */
export async function runWithGateCancellable({ eventBus, store, rawGate, run, signal } = {}) {
  if (!eventBus) {
    throw new Error("[ws-gate] eventBus is required");
  }
  if (!store || typeof store !== "object" || !store.events) {
    throw new Error("[ws-gate] store with events is required");
  }
  if (typeof run !== "function") {
    throw new Error("[ws-gate] run callback is required");
  }

  throwIfAborted(signal);

  const gate = validateGateConfig(rawGate);
  if (!gate) {
    await run(null);
    return;
  }

  const targetEvent = gate.once || gate.on;
  const useOnce = !!gate.once;
  const timeoutMs = gate.timeout_ms || null;

  const name = String(targetEvent || "").trim();
  if (!name) {
    throw new Error("[ws-gate] gate target event name must be non-empty");
  }

  const status = store.events[name];
  if (useOnce && status && status.fired) {
    await run(status.lastPayload);
    return;
  }

  await new Promise((resolve, reject) => {
    let done = false;
    let timerId = null;

    const unsubscribe = eventBus.onGlobal
      ? eventBus.onGlobal(name, handler, { subscriberId: "WsGateRunner" })
      : eventBus.on(name, handler, { subscriberId: "WsGateRunner" });

    const onAbort = () => {
      cleanup();
      reject(new GateCancelledError("[ws-gate] cancelled"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      try {
        signal.addEventListener("abort", onAbort, { once: true });
      } catch (e) {
        // logger-guard
        void e;
      }
    }

    function cleanup() {
      if (done) { return; }
      done = true;
      try {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      } catch (e) {
        // logger-guard
        void e;
      }
      if (signal) {
        try {
          signal.removeEventListener("abort", onAbort);
        } catch (e) {
          // logger-guard
          void e;
        }
      }
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    }

    function handler(payload) {
      if (signal?.aborted) {
        cleanup();
        reject(new GateCancelledError("[ws-gate] cancelled"));
        return;
      }
      try {
        markEventFired(store, name, payload);
      } catch (e) {
        // logger-guard
        void e;
      }

      try {
        Promise.resolve(run(payload))
          .then(() => {
            cleanup();
            resolve();
          })
          .catch((err) => {
            cleanup();
            reject(err);
          });
      } catch (e) {
        cleanup();
        reject(e);
      }
    }

    if (timeoutMs && timeoutMs > 0) {
      timerId = setTimeout(() => {
        cleanup();
        reject(new Error(`[ws-gate] timeout waiting for event ${name}`));
      }, timeoutMs);
    }
  });
}
