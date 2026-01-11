/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import { bootstrapPDFViewerAppFeature } from "../app-bootstrap-feature.js";

let installReject;

jest.mock("../../../common/micro-service/app-bootstrap.js", () => ({
  createAppContainer: jest.fn(() => ({
    register: jest.fn(),
    registerGlobal: jest.fn(),
    get: jest.fn()
  })),
  createFeatureRegistry: jest.fn(() => ({
    register: jest.fn(),
    get: jest.fn(),
    installAll: jest.fn(() => new Promise((resolve, reject) => {
      void resolve; // keep pending until destroy() aborts
      installReject = reject;
    })),
    uninstallAll: jest.fn(() => Promise.resolve())
  }))
}));

jest.mock("../../../common/utils/logger.js", () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }),
  setModuleLogLevel: jest.fn(),
  LogLevel: { ERROR: "error" }
}));

jest.mock("../../../common/utils/ws-port-resolver.js", () => ({
  resolveWebSocketPortSync: jest.fn(() => 8080),
  DEFAULT_WS_PORT: 8080
}));

jest.mock("../../../common/utils/notification.js", () => ({
  showInfo: jest.fn()
}));

jest.mock("../../features/infra-app/index.js", () => ({ AppCoreFeature: class {} }));
jest.mock("../../features/pdf-manager/index.js", () => ({ PDFManagerFeature: class {} }));
jest.mock("../../features/infra-ui/index.js", () => ({ UIManagerFeature: class {} }));
jest.mock("../../features/infra-nav-core/index.js", () => ({ CoreNavigationFeature: class {} }));
jest.mock("../../features/pdf-search/index.js", () => ({ SearchFeature: class {} }));
jest.mock("../../features/pdf-url-loader/index.js", () => ({ PDFUrlLoaderFeature: class {} }));
jest.mock("../../features/pdf-annotation/index.js", () => ({ AnnotationFeature: class {} }));
jest.mock("../../features/infra-sidebar/index.js", () => ({ SidebarManagerFeature: class {} }));
jest.mock("../../features/pdf-translator/index.js", () => ({ PDFTranslatorFeature: class {} }));
jest.mock("../../features/pdf-quick-actions/index.js", () => ({ TextSelectionQuickActionsFeature: class {} }));
jest.mock("../../features/pdf-outline/index.js", () => ({ __esModule: true, default: class {} }));
jest.mock("../../features/pdf-card/index.js", () => ({ PDFCardFeature: class {} }));
jest.mock("../../features/ai-assistant/index.js", () => ({ AiAssistantFeature: class {} }));
jest.mock("../../features/pdf-anchor/index.js", () => ({ PDFAnchorFeature: class {} }));
jest.mock("../../features/pdf-resume/index.js", () => ({ PDFResumeFeature: class {} }));
jest.mock("../../../common/features/window-controls/index.js", () => ({ WindowControlsFeature: class {} }));

describe("AppBootstrapFeature — cancellable wait", () => {
  beforeEach(() => {
    installReject = null;

    jest.clearAllMocks();
    document.body.innerHTML = "";

    try {
      window.history.pushState({}, "", "http://localhost/");
    } catch {
      // ignore
    }
  });

  test("destroy() during installAll aborts and prevents unhandled rejections", async () => {
    const onUnhandled = jest.fn();
    process.once("unhandledRejection", onUnhandled);

    try {
      const p = bootstrapPDFViewerAppFeature();

      // 关键：destroy 必须在 installAll pending 期间可用
      expect(window.pdfViewerApp?.destroy).toEqual(expect.any(Function));
      const destroyPromise = window.pdfViewerApp.destroy();
      await destroyPromise;

      await expect(p).rejects.toMatchObject({ name: "AbortError" });

      // installAll 若在 abort 后才结束（resolve/reject），也不应产生 unhandled rejection
      installReject?.(new Error("late failure"));
      await Promise.resolve();
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.removeListener("unhandledRejection", onUnhandled);
    }
  });
});
