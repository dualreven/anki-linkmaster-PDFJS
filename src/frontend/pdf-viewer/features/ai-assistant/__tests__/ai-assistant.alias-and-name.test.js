/**
 * @jest-environment jsdom
 *
 * 目的：
 * - 验证 AiAssistantFeature 的规范名称为 "pdf-ai-assistant"
 * - 验证 FEATURE_ALIASES 注入后，旧名 "ai-assistant" 仍可在 Registry 中识别
 */
import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { DependencyContainer, FeatureRegistry } from "../../../../common/micro-service/index.js";
import FEATURE_ALIASES from "../../../../common/micro-service/feature-aliases.js";
import { AiAssistantFeature } from "../index.js";

describe("AiAssistantFeature — 重命名与别名解析", () => {
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

  test("Feature.name 应为 pdf-ai-assistant", () => {
    const feature = new AiAssistantFeature();
    expect(feature.name).toBe("pdf-ai-assistant");
  });

  test("通过旧名 ai-assistant 仍可在 registry 中被识别（别名→规范名）", () => {
    const feature = new AiAssistantFeature();
    registry.register(feature);
    expect(registry.has("pdf-ai-assistant")).toBe(true);
    expect(registry.has("ai-assistant")).toBe(true);
    expect(registry.getStatus("ai-assistant")).toBe("registered");
  });
});

