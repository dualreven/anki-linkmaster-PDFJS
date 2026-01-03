import { describe, test, expect } from "@jest/globals";
import { resolveInstallOrder } from "../feature-registry-deps.js";

describe("feature-registry-deps: resolveInstallOrder", () => {
  function makeFeature(name, deps = []) {
    return { name, dependencies: deps };
  }

  test("按依赖顺序输出（先依赖，后被依赖），支持 resolveName 别名归一", () => {
    const features = new Map();
    features.set("feature-b", { feature: makeFeature("feature-b", []) });
    features.set("feature-a", { feature: makeFeature("feature-a", ["old-b"]) });

    const resolveName = (n) => (n === "old-b" ? "feature-b" : n);
    const order = resolveInstallOrder({ features, resolveName });

    expect(order).toEqual(["feature-b", "feature-a"]);
  });

  test("检测循环依赖并抛错（错误信息包含 canonical 名）", () => {
    const features = new Map();
    features.set("a", { feature: makeFeature("a", ["b"]) });
    features.set("b", { feature: makeFeature("b", ["a"]) });

    const resolveName = (n) => n;
    expect(() => resolveInstallOrder({ features, resolveName })).toThrow(/Circular dependency detected: a|Circular dependency detected: b/);
  });
});

