// UTF-8 with LF lines
// SMOKE: 最小依赖，验证注册表可创建与最小特性可注册
import { DependencyContainer } from "../micro-service/dependency-container.js";
import { FeatureRegistry } from "../micro-service/feature-registry.js";

describe("SMOKE - FeatureRegistry minimal", () => {
  test("should create registry and register a tiny feature", async () => {
    const container = new DependencyContainer("smoke");
    const registry = new FeatureRegistry({ container });

    const tiny = {
      name: "smoke-feature",
      version: "0.0.1",
      dependencies: [],
      async install() { /* no-op */ },
      async uninstall() { /* no-op */ }
    };

    registry.register(tiny);
    expect(registry.has("smoke-feature")).toBe(true);
  });
});
