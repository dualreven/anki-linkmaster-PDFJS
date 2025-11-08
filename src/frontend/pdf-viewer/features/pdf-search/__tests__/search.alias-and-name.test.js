/**
 * @jest-environment jsdom
 *
 * 目的：
 * - 验证 SearchFeature 的规范名称为 "pdf-search"
 * - 验证 FEATURE_ALIASES 注入后，旧名 "search" 仍可在 Registry 中识别
 */
import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { DependencyContainer, FeatureRegistry } from "../../../../common/micro-service/index.js";
import FEATURE_ALIASES from "../../../../common/micro-service/feature-aliases.js";
import { SearchFeature } from "../index.js";

describe("SearchFeature — 重命名与别名解析", () => {
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

  test("Feature.name 应为 pdf-search", () => {
    const feature = new SearchFeature();
    expect(feature.name).toBe("pdf-search");
  });

  test("通过旧名 search 仍可在 registry 中被识别（别名→规范名）", () => {
    const feature = new SearchFeature();
    registry.register(feature);
    expect(registry.has("pdf-search")).toBe(true);
    expect(registry.has("search")).toBe(true);
    expect(registry.getStatus("search")).toBe("registered");
  });
});
