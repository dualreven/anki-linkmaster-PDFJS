import { confirmTextHighlightAction } from "./confirm-dialog.js";

describe("confirmTextHighlightAction (fail-closed)", () => {
  it("resolves false when DOM unavailable", async () => {
    const logger = { error: jest.fn() };
    const result = await confirmTextHighlightAction("x", { doc: null, logger });
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it("resolves true/false based on user click", async () => {
    const logger = { error: jest.fn() };

    const promise1 = confirmTextHighlightAction("确认？", { logger });
    const okBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "确定");
    expect(okBtn).not.toBeUndefined();
    okBtn.click();
    await expect(promise1).resolves.toBe(true);

    const promise2 = confirmTextHighlightAction("确认？", { logger });
    const cancelBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "取消");
    expect(cancelBtn).not.toBeUndefined();
    cancelBtn.click();
    await expect(promise2).resolves.toBe(false);
  });
});

