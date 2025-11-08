/**
 * 回归bug测试（负向）：URL 旧参数 bookmarkId 不应触发大纲导航
 */

import { EventBus } from "../../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import URLNavigationFeature from "../index.js";

describe("URLNavigationFeature — 旧参数 bookmarkId 应被忽略", () => {
  let eventBus;
  let container;
  let emitted = [];

  beforeEach(() => {
    // 设置包含 pdf-id 和旧字段 bookmarkId 的 URL
    const url = "http://localhost/pdf-viewer/?pdf-id=c83c60c58ad2&bookmarkId=outlineItem-XYZ12345";
    window.history.replaceState({}, "", url);

    emitted = [];
    eventBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    const origEmit = eventBus.emit.bind(eventBus);
    eventBus.emit = (evt, data, meta) => {
      emitted.push([evt, data, meta]);
      return origEmit(evt, data, meta);
    };

    // 最小容器桩件
    container = {
      get: (name) => {
        if (name === "eventBus") {return eventBus;}
        if (name === "navigationService") {
          return { navigateTo: async () => ({ success: true, actualPage: 1, actualPosition: null }) };
        }
        return null;
      }
    };
  });

  test("安装后不应发出 OUTLINE.NAVIGATE_BY_ID.REQUESTED（因为未提供 outline-item-id）", async () => {
    const feature = new URLNavigationFeature();
    await feature.install({ container, globalEventBus: eventBus });

    const anyOutlineById = emitted.find(([evt]) => evt === PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED);
    expect(anyOutlineById).toBeUndefined();
  });
});

