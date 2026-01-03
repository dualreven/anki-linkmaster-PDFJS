/**
 * @jest-environment jsdom
 */
import { describe, test, expect, jest, beforeEach } from "@jest/globals";

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

const mockEventBusSingleton = { emit: jest.fn() };

jest.mock("../../common/event/event-bus.js", () => ({
  __esModule: true,
  default: mockEventBusSingleton
}));

jest.mock("../../common/micro-service/app-bootstrap.js", () => ({
  __esModule: true,
  createAppContainer: jest.fn(() => ({})),
  createFeatureRegistry: jest.fn(() => ({
    register: jest.fn(),
    installAll: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    uninstallAll: jest.fn()
  }))
}));

function mockNoopFeature(name) {
  return class {
    static featureName = name;
    async install() { }
    async uninstall() { }
  };
}

jest.mock("../features/infra-app/index.js", () => ({ __esModule: true, AppCoreFeature: mockNoopFeature("infra-app") }));
jest.mock("../features/pdf-manager/index.js", () => ({ __esModule: true, PDFManagerFeature: mockNoopFeature("pdf-manager") }));
jest.mock("../features/infra-ui/index.js", () => ({ __esModule: true, UIManagerFeature: mockNoopFeature("infra-ui") }));
jest.mock("../features/infra-nav-core/index.js", () => ({ __esModule: true, CoreNavigationFeature: mockNoopFeature("infra-nav-core") }));
jest.mock("../features/pdf-search/index.js", () => ({ __esModule: true, SearchFeature: mockNoopFeature("pdf-search") }));
jest.mock("../features/pdf-url-loader/index.js", () => ({ __esModule: true, PDFUrlLoaderFeature: mockNoopFeature("pdf-url-loader") }));
jest.mock("../features/pdf-annotation/index.js", () => ({ __esModule: true, AnnotationFeature: mockNoopFeature("pdf-annotation") }));
jest.mock("../features/infra-sidebar/index.js", () => ({ __esModule: true, SidebarManagerFeature: mockNoopFeature("infra-sidebar") }));
jest.mock("../features/pdf-translator/index.js", () => ({ __esModule: true, PDFTranslatorFeature: mockNoopFeature("pdf-translator") }));
jest.mock("../features/pdf-quick-actions/index.js", () => ({ __esModule: true, TextSelectionQuickActionsFeature: mockNoopFeature("pdf-quick-actions") }));
jest.mock("../features/pdf-outline/index.js", () => ({ __esModule: true, OutlineManager: mockNoopFeature("pdf-outline") }));
jest.mock("../features/pdf-card/index.js", () => ({ __esModule: true, PDFCardFeature: mockNoopFeature("pdf-card") }));
jest.mock("../features/ai-assistant/index.js", () => ({ __esModule: true, AiAssistantFeature: mockNoopFeature("ai-assistant") }));
jest.mock("../features/pdf-anchor/index.js", () => ({ __esModule: true, PDFAnchorFeature: mockNoopFeature("pdf-anchor") }));
jest.mock("../features/pdf-resume/index.js", () => ({ __esModule: true, PDFResumeFeature: mockNoopFeature("pdf-resume") }));
jest.mock("../../common/features/window-controls/index.js", () => ({ __esModule: true, WindowControlsFeature: mockNoopFeature("window-controls") }));
jest.mock("../../common/utils/notification.js", () => ({ __esModule: true, showInfo: jest.fn() }));
jest.mock("../../common/utils/ws-port-resolver.js", () => ({ __esModule: true, resolveWebSocketPortSync: jest.fn(() => 12345), DEFAULT_WS_PORT: 12345 }));

describe("app-bootstrap-feature：Bootstrap 自动加载补齐 pdfId", () => {
  beforeEach(() => {
    mockEventBusSingleton.emit.mockClear();
    window.PDF_PATH = undefined;
    window.history.pushState({}, "", "http://localhost/pdf-viewer/index.html");
  });

  test("当通过 ?file=... 启动且文件名包含 12hex 时，FILE.LOAD.REQUESTED 携带 pdfId", async () => {
    const { bootstrapPDFViewerAppFeature } = await import("../bootstrap/app-bootstrap-feature.js");

    const filePath = "C:/tmp/demo-abc123def456.pdf";
    window.history.pushState({}, "", `http://localhost/pdf-viewer/index.html?file=${encodeURIComponent(filePath)}`);

    await bootstrapPDFViewerAppFeature();

    expect(mockEventBusSingleton.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      expect.objectContaining({
        file_path: filePath,
        filename: "demo-abc123def456.pdf",
        pdfId: "abc123def456"
      }),
      expect.any(Object)
    );
  });
});
