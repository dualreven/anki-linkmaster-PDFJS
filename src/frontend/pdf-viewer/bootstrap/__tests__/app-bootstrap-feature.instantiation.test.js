import { jest } from "@jest/globals";
import { bootstrapPDFViewerAppFeature } from "../app-bootstrap-feature.js";
import { createAppContainer } from "../../../common/micro-service/app-bootstrap.js";

// Mock dependencies
jest.mock("../../../common/micro-service/app-bootstrap.js", () => ({
  createAppContainer: jest.fn(() => ({
    register: jest.fn(),
    registerGlobal: jest.fn(),
    get: jest.fn()
  })),
  createFeatureRegistry: jest.fn(() => ({
    register: jest.fn(),
    installAll: jest.fn().mockResolvedValue(),
    get: jest.fn()
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

// Mock ws-port-resolver
jest.mock("../../../common/utils/ws-port-resolver.js", () => ({
  resolveWebSocketPortSync: jest.fn(() => 8080),
  DEFAULT_WS_PORT: 8080
}));

// Mock features
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

describe("AppBootstrapFeature", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // jsdom 下不建议直接重写 window.location（会触发 not implemented: navigation）
    // 用 pushState 设置 search 即可满足本测试需求。
    try {
      window.history.pushState({}, "", "http://localhost/");
    } catch {
      // ignore
    }
  });

  test("should not instantiate/register WSClient in bootstrap layer", async () => {
    await bootstrapPDFViewerAppFeature();

    expect(createAppContainer).toHaveBeenCalledTimes(1);
    const container = createAppContainer.mock.results[0].value;
    expect(container.register).not.toHaveBeenCalledWith("wsClient", expect.anything());
    expect(container.registerGlobal).not.toHaveBeenCalledWith("wsClient", expect.anything());

  });
});
