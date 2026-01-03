import { buildAllowedOutboundTypes } from "../ws-client-contract.js";

describe("ws-client-contract.buildAllowedOutboundTypes", () => {
  test("仅收集 *:requested 与 *:request", () => {
    const allowed = buildAllowedOutboundTypes({
      A: "x:y:requested",
      B: "x:y:request",
      C: "x:y:completed",
      D: 123,
    });
    expect(allowed.has("x:y:requested")).toBe(true);
    expect(allowed.has("x:y:request")).toBe(true);
    expect(allowed.has("x:y:completed")).toBe(false);
  });
});

