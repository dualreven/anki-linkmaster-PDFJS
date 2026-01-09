/**
 * 轻量验证：不调用 install（避免 jstree/DOM 依赖），仅校验元数据
 */
import { OutlineFeature } from "../index.js";

describe("OutlineFeature — 元数据校验", () => {
  test("name/version/dependencies 应符合规范", () => {
    const f = new OutlineFeature();
    expect(f.name).toBe("pdf-outline");
    expect(typeof f.version).toBe("string");
    expect(Array.isArray(f.dependencies)).toBe(true);
    // 依赖包含核心模块（避免回归）
    expect(f.dependencies).toEqual(expect.arrayContaining(["pdf-manager", "infra-ui", "infra-nav-core"]));
  });
});

