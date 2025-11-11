/**
 * 目的：EventBus 核心行为测试（不依赖浏览器/UI）
 * - 本地事件（@scope/xxx）订阅/发布/一次性订阅
 * - 全局事件白名单拦截（使用非法事件名应被阻止）
 * - 事件名校验：段数不为3时禁止订阅/发布
 * - 管理器：同 moduleName 返回单例
 */
import { EventBus, getEventBus, getAllEventBuses } from "../event-bus.js";
import { PDF_VIEWER_EVENTS } from "../pdf-viewer-constants.js";

describe("EventBus 核心行为", () => {
  test("本地事件 on/emit/once 正常工作", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    const fn = jest.fn();
    const once = jest.fn();
    // 使用规范事件常量（直接内联），避免自定义规则拦截变量转发
    bus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, fn, { subscriberId: "s1" });
    bus.once(PDF_VIEWER_EVENTS.ZOOM.CHANGED, once, { subscriberId: "s2" });

    bus.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, { a: 1 }, { actorId: "tester" });
    bus.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, { a: 2 }, { actorId: "tester" });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(once).toHaveBeenCalledTimes(1);
  });

  test("全局事件未在白名单时：订阅/发布均被阻止", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    const fn = jest.fn();
    // 订阅会被拒绝（返回空取消函数），但不会抛异常
    // eslint-disable-next-line custom/event-name-format
    const unsub = bus.on("unknown:bad:event", fn, { subscriberId: "s1" });
    expect(typeof unsub).toBe("function");
    // 发布同样被拒绝，不应触发回调
    // eslint-disable-next-line custom/event-name-format
    bus.emit("unknown:bad:event", { x: 1 }, { actorId: "tester" });
    expect(fn).not.toHaveBeenCalled();
  });

  test("事件名校验：超过3段应抛出错误并阻止订阅", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    const fn = jest.fn();
    // eslint-disable-next-line custom/event-name-format
    expect(() => bus.on("@unit/too:many:segments:ignored", fn, { subscriberId: "s1" })).toThrow(/无效的事件名称/);
    // eslint-disable-next-line custom/event-name-format
    bus.emit("@unit/too:many:segments:ignored", {}, { actorId: "tester" }); // 发布同样不会触发
    expect(fn).not.toHaveBeenCalled();
  });

  test("使用合法全局事件名：可订阅/发布", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    const fn = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, fn, { subscriberId: "s1" });
    bus.emit(PDF_VIEWER_EVENTS.PAGE.CHANGING, { page: 2 }, { actorId: "tester" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ page: 2 });
  });

  test("EventBus 管理器：同名返回单例", () => {
    const a1 = getEventBus("PDFViewer", { enableValidation: true });
    const a2 = getEventBus("PDFViewer", { enableValidation: false });
    expect(a1).toBe(a2);
    const all = getAllEventBuses();
    expect(Array.isArray(all)).toBe(true);
    expect(all.some(i => i.moduleName === "PDFViewer")).toBe(true);
  });
});
