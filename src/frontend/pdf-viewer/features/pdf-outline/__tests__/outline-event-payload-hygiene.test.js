import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { handleOutlineNavigateById } from "../outline-navigate-by-id.js";

describe("pdf-outline：事件 payload 体积治理", () => {
  test("OUTLINE.SELECT.CHANGED payload 只应包含 outlineItemId（不包含 outlineItem 深对象）", async () => {
    const calls = [];
    const eventBus = {
      emitGlobal: (eventName, payload, metadata) => {
        calls.push({ eventName, payload, metadata });
      },
    };

    const outlineManager = {
      getOutlineItem: () => ({ id: "outlineItem-123", pageAt: 3, position: 12.3 }),
      setSelectedOutlineItemId: jest.fn(),
    };

    const logger = { info: () => {}, warn: () => {}, error: () => {} };

    await handleOutlineNavigateById({
      logger,
      eventBus,
      outlineManager,
      outlineItemId: "outlineItem-123",
      metadata: { actorId: "test" },
      listReady: true,
      setPendingNavigateId: () => {},
      navigateToOutlineItem: async () => {},
    });

    const selectChanged = calls.find((c) => c.eventName === PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED);
    expect(selectChanged).toBeTruthy();
    expect(selectChanged.payload).toEqual({ outlineItemId: "outlineItem-123" });
    expect(outlineManager.setSelectedOutlineItemId).toHaveBeenCalledWith("outlineItem-123");
  });

  test("当 actorId=OutlineSidebarUI 时不应回写 selection（避免循环）", async () => {
    const calls = [];
    const eventBus = {
      emitGlobal: (eventName, payload, metadata) => {
        calls.push({ eventName, payload, metadata });
      },
    };

    const outlineManager = {
      getOutlineItem: () => ({ id: "outlineItem-123", pageAt: 3, position: 12.3 }),
      setSelectedOutlineItemId: jest.fn(),
    };

    const logger = { info: () => {}, warn: () => {}, error: () => {} };

    await handleOutlineNavigateById({
      logger,
      eventBus,
      outlineManager,
      outlineItemId: "outlineItem-123",
      metadata: { actorId: "OutlineSidebarUI" },
      listReady: true,
      setPendingNavigateId: () => {},
      navigateToOutlineItem: async () => {},
    });

    expect(calls.find((c) => c.eventName === PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED)).toBeFalsy();
    expect(outlineManager.setSelectedOutlineItemId).not.toHaveBeenCalled();
  });
});
