/* @jest-environment jsdom */
import { NavigationRequestGate } from "../components/navigation-request-gate.js";

describe("pdf-url-loader/NavigationRequestGate", () => {
  test("dedupes same key while busy; reset releases", () => {
    const gate = new NavigationRequestGate();
    expect(gate.isBusy()).toBe(false);

    const first = gate.tryEnter("k1");
    expect(first).toEqual({ accepted: true, reason: "accepted" });
    expect(gate.isBusy()).toBe(true);

    const deduped = gate.tryEnter("k1");
    expect(deduped).toEqual({ accepted: false, reason: "deduped" });

    const busy = gate.tryEnter("k2");
    expect(busy).toEqual({ accepted: false, reason: "busy" });

    gate.reset();
    expect(gate.isBusy()).toBe(false);
    expect(gate.tryEnter("k2")).toEqual({ accepted: true, reason: "accepted" });
  });

  test("pending manual nav is cleared on consume and reset", () => {
    const gate = new NavigationRequestGate();
    gate.tryEnter("k1");
    gate.setPendingManualNav({ params: { pageAt: 5 }, startTime: 123 });

    const pending = gate.consumePendingManualNav();
    expect(pending).toEqual({ params: { pageAt: 5 }, startTime: 123 });
    expect(gate.consumePendingManualNav()).toBe(null);

    gate.setPendingManualNav({ params: { pageAt: 6 }, startTime: 456 });
    gate.reset();
    expect(gate.consumePendingManualNav()).toBe(null);
  });
});

