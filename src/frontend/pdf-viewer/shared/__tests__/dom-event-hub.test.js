/**
 * @file DomEventHub 测试
 */

import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals";
import { DomEventHub } from "../dom-event-hub.js";

describe("DomEventHub", () => {
  /** @type {HTMLElement} */
  let viewerContainer;
  /** @type {DomEventHub} */
  let hub;

  beforeEach(() => {
    viewerContainer = document.createElement("div");
    viewerContainer.id = "viewerContainer";
    document.body.appendChild(viewerContainer);
    hub = new DomEventHub({ viewerContainer, documentRef: document, windowRef: window });
  });

  afterEach(() => {
    if (hub) {
      hub.destroy();
      hub = null;
    }
    if (viewerContainer && viewerContainer.parentNode) {
      viewerContainer.parentNode.removeChild(viewerContainer);
    }
  });

  it("应当正确转发 viewerContainer 的 scroll/wheel/click 事件", () => {
    const scrollSpy = jest.fn();
    const wheelSpy = jest.fn();
    const clickSpy = jest.fn();

    hub.onViewerScroll(scrollSpy);
    hub.onViewerWheel(wheelSpy);
    hub.onViewerClick(clickSpy);

    viewerContainer.dispatchEvent(new Event("scroll"));
    viewerContainer.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    viewerContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(wheelSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("取消订阅后不再接收事件", () => {
    const scrollSpy = jest.fn();
    const unsubscribe = hub.onViewerScroll(scrollSpy);

    viewerContainer.dispatchEvent(new Event("scroll"));
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    unsubscribe();

    viewerContainer.dispatchEvent(new Event("scroll"));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("应当通过 onDocumentKeydown 统一挂载键盘事件", () => {
    const keySpy = jest.fn();
    hub.onDocumentKeydown(keySpy);

    const evt = new KeyboardEvent("keydown", { key: "ArrowDown" });
    document.dispatchEvent(evt);

    expect(keySpy).toHaveBeenCalledTimes(1);
    expect(keySpy.mock.calls[0][0]).toBe(evt);
  });
});

