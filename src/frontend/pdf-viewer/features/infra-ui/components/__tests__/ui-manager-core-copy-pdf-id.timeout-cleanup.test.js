import { installCopyPdfIdButton } from "../ui-manager-core-copy-pdf-id.js";

jest.mock("../../../../../common/utils/notification.js", () => {
  return {
    showError: jest.fn(),
    showSuccess: jest.fn(),
  };
});

jest.mock("../../../../../common/utils/copy-utils.js", () => {
  return {
    copyTextUsingHiddenTextarea: jest.fn(() => true),
  };
});

function mountDOM() {
  document.body.innerHTML = `
    <button id="copy-pdf-id-btn" class="btn copy-id-btn" title="复制 PDF ID"></button>
  `;
}

describe("installCopyPdfIdButton timeout cleanup (regression)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  test("uninstall should clear pending timeout and reset button UI state", async () => {
    mountDOM();

    const windowRef = {
      location: { search: "" },
      setTimeout: jest.fn(() => 123),
      clearTimeout: jest.fn(),
    };

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const { unsubs } = installCopyPdfIdButton({
      logger,
      documentRef: document,
      windowRef,
      getCurrentPdfId: () => "doc",
      setCurrentPdfId: jest.fn(),
    });

    const btn = document.getElementById("copy-pdf-id-btn");
    expect(btn).not.toBeNull();

    btn.click();

    expect(windowRef.setTimeout).toHaveBeenCalledTimes(1);
    expect(btn.classList.contains("copied")).toBe(true);
    expect(btn.title).toBe("已复制: doc");

    unsubs.forEach((u) => u());

    expect(windowRef.clearTimeout).toHaveBeenCalledTimes(1);
    expect(windowRef.clearTimeout).toHaveBeenCalledWith(123);
    expect(btn.classList.contains("copied")).toBe(false);
    expect(btn.title).toBe("复制 PDF ID");
  });
});

