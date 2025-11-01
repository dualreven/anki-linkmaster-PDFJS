/**
 * @jest-environment jsdom
 *
 * 目的：
 * - 验证 FeatureRegistry 在 register/has/get/install/installAll 等阶段对别名（aliases）的处理；
 * - 依赖解析时允许旧名/新名混用，安装顺序应正确（先依赖，后被依赖）。
 */
import { FeatureRegistry } from "../feature-registry.js";
import { createContainer } from "../dependency-container.js";
import { EventBus } from "../../event/event-bus.js";

describe("FeatureRegistry — 别名解析（aliases）", () => {
  /**
   * 构造三个功能：
   * - core（无依赖）
   * - feature-b（无依赖）
   * - feature-a（依赖 feature-b），通过别名 old-a / old-b 进行安装与查询
   */
  class CoreFeature {
    get name() { return "app-core"; }
    get version() { return "1.0.0"; }
    get dependencies() { return []; }
    async install() {}
    async uninstall() {}
  }

  function makeFeature(name, deps = []) {
    return {
      get name() { return name; },
      get version() { return "0.1.0"; },
      get dependencies() { return deps; },
      async install() {},
      async uninstall() {}
    };
  }

  test("register/has/get/install 支持旧名/新名混用；安装顺序先依赖后被依赖", async () => {
    const container = createContainer("test");
    const globalEventBus = new EventBus({ enableValidation: false, moduleName: "test" });
    const calls = [];

    const b = makeFeature("feature-b", []);
    // 在 install 中记录安装顺序
    b.install = async () => { calls.push("B"); };

    const a = makeFeature("feature-a", ["old-b"]); // 依赖旧名
    a.install = async () => { calls.push("A"); };

    // 创建注册中心并设置别名映射
    const registry = new FeatureRegistry({
      container,
      globalEventBus,
      aliases: {
        "old-a": "feature-a",
        "old-b": "feature-b"
      }
    });

    // 注册：用新名注册，但可通过旧名查询/安装
    registry.register(new CoreFeature());
    registry.register(b);
    registry.register(a);

    expect(registry.has("feature-a")).toBe(true);
    expect(registry.has("old-a")).toBe(true); // 旧名命中
    expect(registry.has("feature-b")).toBe(true);
    expect(registry.has("old-b")).toBe(true);

    // 通过 installAll()，应按依赖顺序安装（先 B 后 A），且别名在拓扑排序中生效
    await registry.installAll();
    expect(calls).toEqual(["B", "A"]);
  });

  test("重复注册（别名映射到同一规范名）应报错", () => {
    const container = createContainer("test");
    const globalEventBus = new EventBus({ enableValidation: false, moduleName: "test" });
    const registry = new FeatureRegistry({
      container,
      globalEventBus,
      aliases: { "old-a": "feature-a" }
    });

    registry.register(makeFeature("feature-a"));
    expect(() => registry.register(makeFeature("old-a"))).toThrow(/already registered/i);
  });
});
