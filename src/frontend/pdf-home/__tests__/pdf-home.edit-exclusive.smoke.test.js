/**
 * 冒烟：编辑能力互斥（仅启用 pdf-edit，禁用 pdf-editor）
 * 断言：
 * - 触发全局事件 pdf:edit:requested 后，仅出现一个模态框；
 * - 存在 pdf-edit 的表单 #pdf-edit-form；
 * - 不存在 pdf-editor 的容器 #pdf-editor-modal。
 */

import { EventBus } from "../../common/event/event-bus.js";
import { ScopedEventBus } from "../../common/event/scoped-event-bus.js";
import { PDF_MANAGEMENT_EVENTS } from "../../common/event/event-constants.js";
import { PDFEditFeature } from "../features/pdf-edit/index.js";

function createContainer(eventBus) {
  // 简易 DI 容器桩：仅提供 eventBus；不提供 wsClient（允许 pdf-edit 以 warn 降级）
  return {
    has(key) {
      return key === "eventBus";
    },
    get(key) {
      if (key === "eventBus") { return eventBus; }
      return null;
    }
  };
}

describe("pdf-home/edit-exclusive-smoke", () => {
  test("仅 pdf-edit 响应编辑请求，渲染一个模态框", async () => {
    // 准备：全局事件总线与作用域事件总线
    const globalEventBus = new EventBus({ moduleName: "pdf-home-test", enableValidation: false });
    const scopedEventBus = new ScopedEventBus(globalEventBus, "pdf-home-test");

    // 安装 pdf-edit（生产化实现）
    const feature = new PDFEditFeature();
    await feature.install({
      logger: null, // 使用 jest.config.js 中的 logger mock
      scopedEventBus,
      globalEventBus,
      container: createContainer(globalEventBus),
    });

    // 触发全局“编辑请求”事件
    const record = { id: "id-001", filename: "demo.pdf", title: "Demo" };
    globalEventBus.emit(PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED, record);

    // 等待 UI 渲染（ModalManager 内部有 rAF + 定时器）
    await new Promise((r) => setTimeout(r, 30));

    // 断言：仅一个模态框/遮罩层
    const modals = document.querySelectorAll(".pdf-modal");
    const overlays = document.querySelectorAll(".pdf-modal-overlay");
    expect(modals.length).toBe(1);
    expect(overlays.length).toBe(1);

    // 断言：pdf-edit 的表单存在
    expect(document.getElementById("pdf-edit-form")).not.toBeNull();

    // 断言：pdf-editor 的容器不存在（互斥）
    expect(document.getElementById("pdf-editor-modal")).toBeNull();
  });
});

