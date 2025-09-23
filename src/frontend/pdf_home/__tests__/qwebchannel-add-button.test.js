import { PDF_MANAGEMENT_EVENTS, UI_EVENTS } from "../../common/event/event-constants.js";
import { EventBus } from "../../common/event/event-bus.js";

const selectPdfFilesMock = jest.fn();
const getPdfListMock = jest.fn();
let listUpdatedCallback = null;

jest.mock("../table-wrapper.js", () => ({
  TableWrapper: class {
    constructor() {
      this.tabulator = {
        on: jest.fn(),
      };
      this.tableWrapper = document.createElement('div');
    }
    initialize() { return Promise.resolve(); }
    setData() {}
    destroy() {}
  }
}));

const uiShowSuccessMock = jest.fn();
const uiShowErrorMock = jest.fn();

jest.mock("../ui-manager.js", () => ({
  UIManager: class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.pdfTable = null;
    }
    initialize() { return Promise.resolve(); }
    destroy() {}
    showSuccess(message) { uiShowSuccessMock(message); }
    showError(message) { uiShowErrorMock(message); }
  }
}));

const addPdfLegacyMock = jest.fn();

jest.mock("../../common/pdf/pdf-manager.js", () => ({
  __esModule: true,
  default: class {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    }
    initialize() { return Promise.resolve(); }
    destroy() {}
    getPDFs() { return []; }
    addPDF = addPdfLegacyMock;
  }
}));

jest.mock("../../common/utils/logger.js", () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return {
    __esModule: true,
    LogLevel: { INFO: "info" },
    getLogger: jest.fn(() => logger),
    setGlobalWebSocketClient: jest.fn(),
  };
});

jest.mock("../../common/utils/console-websocket-bridge.js", () => ({
  createConsoleWebSocketBridge: jest.fn(() => ({ enable: jest.fn(), disable: jest.fn() })),
}));

jest.mock("../utils/ws-port-resolver.js", () => ({
  __esModule: true,
  DEFAULT_WS_PORT: 8765,
  resolveWebSocketPort: jest.fn(() => Promise.resolve(8765)),
  resolveWebSocketPortSync: jest.fn(() => 8765),
}));

jest.mock("../qwebchannel-bridge.js", () => ({
  __esModule: true,
  initPdfHomeChannel: jest.fn(() => Promise.resolve({
    bridge: {
      selectPdfFiles: jest.fn((...args) => selectPdfFilesMock(...args)),
      getPdfList: jest.fn(() => getPdfListMock()),
      pdfListUpdated: {
        connect: jest.fn((cb) => { listUpdatedCallback = cb; }),
        disconnect: jest.fn((cb) => { if (listUpdatedCallback === cb) listUpdatedCallback = null; }),
      },
    },
    onListUpdated: (cb) => { listUpdatedCallback = cb; },
  })),
}));

import { initPdfHomeChannel } from "../qwebchannel-bridge.js";
import { PDFHomeApp } from "../index.js";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("PDFHomeApp QWebChannel integration for add button", () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const wsClient = {
    isConnected: jest.fn(() => true),
    connect: jest.fn(() => Promise.resolve()),
    send: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="pdf-table-container"></div>';
    selectPdfFilesMock.mockResolvedValue(["C:/docs/sample.pdf"]);
    getPdfListMock.mockResolvedValue([{ id: "sample", filename: "sample.pdf" }]);
    addPdfLegacyMock.mockClear();
    uiShowSuccessMock.mockClear();
    uiShowErrorMock.mockClear();
    wsClient.isConnected.mockReturnValue(true);
    wsClient.connect.mockResolvedValue();
    wsClient.send.mockClear();
    wsClient.disconnect.mockClear();
    listUpdatedCallback = null;
    initPdfHomeChannel.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("routes add PDF requests through QWebChannel and emits completion", async () => {
    const eventBus = new EventBus({ moduleName: "pdf-home-test", enableValidation: false, logger });
    const container = {
      getDependencies: () => ({ logger, eventBus, wsClient }),
      initialize: jest.fn(() => Promise.resolve()),
      isInitialized: jest.fn(() => true),
    };

    const app = new PDFHomeApp({ container });
    await app.initialize();

    const addCompleted = jest.fn();
    const successMessages = [];
    const listUpdates = [];

    eventBus.on(PDF_MANAGEMENT_EVENTS.ADD.COMPLETED, (payload) => { addCompleted(payload); }, { subscriberId: "test:add" });
    eventBus.on(UI_EVENTS.SUCCESS.SHOW, (message) => { successMessages.push(message); }, { subscriberId: "test:ui" });
    eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (payload) => { listUpdates.push(payload); }, { subscriberId: "test:list" });

    eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED);
    await flushMicrotasks();

    expect(selectPdfFilesMock).toHaveBeenCalledTimes(1);
    expect(addPdfLegacyMock).not.toHaveBeenCalled();
    expect(addCompleted).toHaveBeenCalledTimes(1);
    expect(addCompleted.mock.calls[0][0]).toEqual({ files: ["C:/docs/sample.pdf"], source: "qwebchannel" });
    expect(successMessages[0]).toMatch(/1/);

    if (typeof listUpdatedCallback === "function") {
      listUpdatedCallback([{ id: "a", filename: "a.pdf" }]);
      await flushMicrotasks();
    }
    expect(listUpdates).toContainEqual([{ id: "a", filename: "a.pdf" }]);

    app.destroy();
  });
});
