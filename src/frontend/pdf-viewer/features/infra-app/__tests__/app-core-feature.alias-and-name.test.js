/**
 * @jest-environment jsdom
 *
 * 目的：
 * - 验证 AppCoreFeature 的规范名称已改为 "infra-app"
 * - 验证 FeatureRegistry 在注入 FEATURE_ALIASES 后，仍可通过旧名 "app-core" 进行查询（别名解析）
 */
import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { DependencyContainer, FeatureRegistry } from "../../../../common/micro-service/index.js";
import FEATURE_ALIASES from "../../../../common/micro-service/feature-aliases.js";
import { AppCoreFeature } from "../index.js";

describe("AppCoreFeature — 重命名与别名解析", () => {
  let registry;

  beforeEach(() => {
    const container = new DependencyContainer("pdf-viewer-test");
    const mockEventBus = { on: jest.fn(), emit: jest.fn(), off: jest.fn() };
    registry = new FeatureRegistry({
      container,
      globalEventBus: mockEventBus,
      aliases: FEATURE_ALIASES
    });
  });

  test("Feature.name 应为 infra-app", () => {
    const feature = new AppCoreFeature();
    expect(feature.name).toBe("infra-app");
  });

  test("通过旧名 app-core 仍可在 registry 中被识别（别名→规范名）", () => {
    const feature = new AppCoreFeature();
    registry.register(feature);

    // 旧名与新名都应可查询
    expect(registry.has("infra-app")).toBe(true);
    expect(registry.has("app-core")).toBe(true);

    expect(registry.getStatus("infra-app")).toBe("registered");
    expect(registry.getStatus("app-core")).toBe("registered"); // 旧名经别名解析
  });
});
