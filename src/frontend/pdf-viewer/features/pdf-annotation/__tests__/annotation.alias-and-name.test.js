/**
 * @jest-environment jsdom
 *
 * 目的：
 * - 验证 AnnotationFeature 的规范名称为 "pdf-annotation"
 * - 验证 FEATURE_ALIASES 注入后，旧名 "annotation" 仍可在 Registry 中识别
 */
import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { DependencyContainer, FeatureRegistry } from "../../../../common/micro-service/index.js";
import FEATURE_ALIASES from "../../../../common/micro-service/feature-aliases.js";
import { AnnotationFeature } from "../index.js";

describe("AnnotationFeature — 重命名与别名解析", () => {
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

  test("Feature.name 应为 pdf-annotation", () => {
    const feature = new AnnotationFeature();
    expect(feature.name).toBe("pdf-annotation");
  });

  test("通过旧名 annotation 仍可在 registry 中被识别（别名→规范名）", () => {
    const feature = new AnnotationFeature();
    registry.register(feature);
    expect(registry.has("pdf-annotation")).toBe(true);
    expect(registry.has("annotation")).toBe(true);
    expect(registry.getStatus("annotation")).toBe("registered");
  });
});
