import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
const PDF_TRANSLATOR_EVENTS = PDF_VIEWER_EVENTS.TRANSLATOR;

describe("Global event allowlist for pdf-translator events", () => {
  it("allows emitting pdf-translator:text:selected without being blocked", () => {
    const bus = new EventBus({ enableValidation: true });

    const handler = jest.fn();
    bus.on(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED, handler);

    const payload = { text: "hello", pageNumber: 1 };
    bus.emit(PDF_TRANSLATOR_EVENTS.TEXT.SELECTED, payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });
});

