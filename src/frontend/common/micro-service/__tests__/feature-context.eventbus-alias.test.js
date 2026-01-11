import { EventBus } from "../../event/event-bus.js";
import { DependencyContainer } from "../dependency-container.js";
import { createFeatureContext } from "../feature-registry-context.js";

describe("FeatureRegistry FeatureContext - eventBus alias (G) - contract regression", () => {
  test("context.eventBus 是 context.globalEventBus 的只读别名（同一引用）", async () => {
    const globalEventBus = new EventBus({ moduleName: `ctx-test-${Date.now()}`, enableValidation: true });
    const container = new DependencyContainer("ctx-test");
    const features = new Map([["feature-a", { feature: { name: "feature-a" } }]]);

    const ctx = await createFeatureContext({
      featureName: "feature-a",
      container,
      globalEventBus,
      features
    });

    expect(ctx.globalEventBus).toBe(globalEventBus);
    expect(ctx.eventBus).toBe(globalEventBus);

    expect(() => {
      ctx.eventBus = null;
    }).toThrow();
  });

  test("globalEventBus 缺失时，不提供 eventBus 兜底字段", async () => {
    const container = new DependencyContainer("ctx-test");
    const features = new Map([["feature-a", { feature: { name: "feature-a" } }]]);

    const ctx = await createFeatureContext({
      featureName: "feature-a",
      container,
      globalEventBus: null,
      features
    });

    expect(ctx.globalEventBus).toBeNull();
    expect("eventBus" in ctx).toBe(false);
  });
});
