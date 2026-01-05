import { AnnotationManager } from "../annotation.manager.v2.js";
import { Annotation } from "../../../../../common/models/annotation.js";

describe("AnnotationManager V2 (Observable)", () => {
  let manager;
  let mockEventBus;
  let mockLogger;
  let mockWSClient;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      onGlobal: jest.fn()
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockWSClient = {
      isConnected: jest.fn().mockReturnValue(true),
      request: jest.fn().mockResolvedValue({})
    };

    // Mock container for wsClient
    const container = {
      getWSClient: () => mockWSClient
    };

    manager = new AnnotationManager(mockEventBus, mockLogger, container);
  });

  test("should initialize with default state", () => {
    const state = manager.store.get();
    expect(state.annotations).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.pdfId).toBeNull();
  });

  test("should set pdfId", () => {
    manager.setPdfId("test-pdf");
    expect(manager.store.get().pdfId).toBe("test-pdf");
  });

  test("should add annotation", async () => {
    manager.setPdfId("test-pdf");
    const ann = new Annotation({
      id: "1",
      type: "text-highlight",
      pageNumber: 1,
      data: {
        selectedText: "test",
        textRanges: [{ start: 0, end: 4 }],
        highlightColor: "#ff0000"
      }
    });
    await manager.createAnnotation(ann);

    const state = manager.store.get();
    expect(state.annotations.length).toBe(1);
    expect(state.annotations[0].id).toBe("1");
  });

  test("should update annotation", async () => {
    manager.setPdfId("test-pdf");
    const ann = new Annotation({
      id: "1",
      type: "text-highlight",
      pageNumber: 1,
      data: {
        selectedText: "old",
        textRanges: [{ start: 0, end: 3 }],
        highlightColor: "#ff0000"
      }
    });
    await manager.createAnnotation(ann);

    await manager.updateAnnotation("1", { data: { selectedText: "new" } });
    const state = manager.store.get();
    expect(state.annotations[0].data.selectedText).toBe("new");
  });

  test("should delete annotation", async () => {
    manager.setPdfId("test-pdf");
    const ann = new Annotation({
      id: "1",
      type: "text-highlight",
      pageNumber: 1,
      data: {
        selectedText: "test",
        textRanges: [{ start: 0, end: 4 }],
        highlightColor: "#ff0000"
      }
    });
    await manager.createAnnotation(ann);

    await manager.deleteAnnotation("1");
    const state = manager.store.get();
    expect(state.annotations.length).toBe(0);
  });
});
