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
    const EVT = "@unit/event:ok:done";
    const fn = jest.fn();
    const once = jest.fn();
    bus.on(EVT, fn, { subscriberId: "s1" });
    bus.once(EVT, once, { subscriberId: "s2" });

    bus.emit(EVT, { a: 1 }, { actorId: "tester" });
    bus.emit(EVT, { a: 2 }, { actorId: "tester" });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(once).toHaveBeenCalledTimes(1);
  });

  test("全局事件未在白名单时：订阅/发布均被阻止", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    const EVT = "unknown:bad:event";
    const fn = jest.fn();
    // 订阅会被拒绝（返回空取消函数），但不会抛异常
    const unsub = bus.on(EVT, fn, { subscriberId: "s1" });
    expect(typeof unsub).toBe("function");
    // 发布同样被拒绝，不应触发回调
    bus.emit(EVT, { x: 1 }, { actorId: "tester" });
    expect(fn).not.toHaveBeenCalled();
  });

  test("事件名校验：超过3段应抛出错误并阻止订阅", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    const EVT_BAD = "@unit/too:many:segments:ignored";
    const fn = jest.fn();
    expect(() => bus.on(EVT_BAD, fn, { subscriberId: "s1" })).toThrow(/无效的事件名称/);
    bus.emit(EVT_BAD, {}, { actorId: "tester" }); // 发布同样不会触发
    expect(fn).not.toHaveBeenCalled();
  });

  test("使用合法全局事件名：可订阅/发布", () => {
    const bus = new EventBus({ moduleName: "UnitBus", enableValidation: true });
    const EVT = PDF_VIEWER_EVENTS.PAGE.CHANGING; // 已在白名单
    const fn = jest.fn();
    bus.on(EVT, fn, { subscriberId: "s1" });
    bus.emit(EVT, { page: 2 }, { actorId: "tester" });
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
