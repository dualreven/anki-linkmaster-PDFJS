import { EventBus, EventNameValidator } from "../event-bus.js";
import { EventNameValidator as DirectEventNameValidator } from "../event-name-validator.js";
import { PDF_VIEWER_EVENTS } from "../pdf-viewer-constants.js";

describe("event-bus extracted modules", () => {
  test("EventNameValidator 对外可用（valid/invalid）", () => {
    expect(DirectEventNameValidator.validate("a:b:c")).toBe(true);
    expect(DirectEventNameValidator.validate("a:b")).toBe(false);
    expect(typeof DirectEventNameValidator.getValidationError("a:b", {})).toBe("string");
    expect(DirectEventNameValidator.getValidationError("a:b:c", {})).toBeNull();

    expect(typeof EventNameValidator.getValidationError).toBe("function");
  });

  test("重复订阅同一 subscriberId 应抛错（行为不变）", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    bus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, () => {}, { subscriberId: "s1" });
    expect(() => bus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, () => {}, { subscriberId: "s1" })).toThrow(/重复订阅/);
  });
});
