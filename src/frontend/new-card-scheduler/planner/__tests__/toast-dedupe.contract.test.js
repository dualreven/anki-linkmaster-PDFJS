import { createToastDedupeGate } from "../utils/toast-dedupe.js";

describe("toast dedupe gate - contract regression", () => {
  test("同 key 在窗口内去重；超出窗口允许再次 toast", () => {
    let t = 0;
    const gate = createToastDedupeGate({ windowMs: 2000, now: () => t });

    expect(gate.shouldToast("e1")).toBe(true);

    t = 1000;
    expect(gate.shouldToast("e1")).toBe(false);

    t = 2001;
    expect(gate.shouldToast("e1")).toBe(true);
  });

  test("空 key 不去重（始终允许 toast）", () => {
    let t = 0;
    const gate = createToastDedupeGate({ windowMs: 2000, now: () => t });

    expect(gate.shouldToast("")).toBe(true);
    t = 1000;
    expect(gate.shouldToast("")).toBe(true);
  });
});

