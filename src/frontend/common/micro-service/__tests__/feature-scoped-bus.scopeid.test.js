/**
 * @jest-environment jsdom
 *
 * 目的：
 * - 验证 ScopedEventBus 的作用域取自 Feature.SCOPE_ID 而非 Feature.name；
 * - 即使 Feature.name 与 SCOPE_ID 不同，也应使用 SCOPE_ID 作为事件前缀。
 */
import { FeatureRegistry } from "../feature-registry.js";
import { createContainer } from "../dependency-container.js";
import { EventBus } from "../../event/event-bus.js";

// 测试专用事件常量，避免在 EventBus 上直接使用字符串字面量
const SCOPED_TEST_EVENTS = {
  PING: "ping",
};

describe("FeatureRegistry — ScopedEventBus 作用域与名称解耦（SCOPE_ID）", () => {
  class DummyFeature {
    static SCOPE_ID = "annotation"; // 固定作用域
    get name() { return "annotation-renamed"; } // 与 SCOPE_ID 不一致
    get version() { return "0.0.1"; }
    get dependencies() { return []; }
    async install(context) {
      // 断言作用域来自 SCOPE_ID
      const scope = context.scopedEventBus.getScope();
      expect(scope).toBe("annotation");
      // 同时验证可用性：本地事件前缀应为 @annotation/...
      let handled = false;
      const off = context.scopedEventBus.on(SCOPED_TEST_EVENTS.PING, (d) => {
        handled = d === 42;
      });
      // emit/断言
      context.scopedEventBus.emit(SCOPED_TEST_EVENTS.PING, 42);
      off();
      expect(handled).toBe(true);
    }
    async uninstall() {}
  }

  test("SCOPE_ID 优先生效，改变 name 不影响事件作用域", async () => {
    const container = createContainer("test");
    const globalEventBus = new EventBus({ enableValidation: false, moduleName: "test" });
    const registry = new FeatureRegistry({ container, globalEventBus });

    // 注册并安装
    registry.register(new DummyFeature());
    await registry.install("annotation-renamed");
  });
});
