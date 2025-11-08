/**
 * 静态测试：feature-flags.json 双写键（规范名 + 旧名）应并存且保持一致含义
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadFlags() {
  const p = resolve(process.cwd(), "src/frontend/pdf-viewer/config/feature-flags.json");
  return JSON.parse(readFileSync(p, { encoding: "utf8" })).flags || {};
}

describe("feature-flags — dual keys (canonical + legacy)", () => {
  test("infra-ws-adapter 与 websocket-adapter 均存在", () => {
    const flags = loadFlags();
    expect(flags["websocket-adapter"]).toBeDefined();
    expect(flags["infra-ws-adapter"]).toBeDefined();
    // 关键字段一致（enabled/metadata.priority）
    expect(!!flags["infra-ws-adapter"].enabled).toBe(!!flags["websocket-adapter"].enabled);
    expect(flags["infra-ws-adapter"].metadata?.priority).toBe(flags["websocket-adapter"].metadata?.priority);
  });

  test("新增规范名键存在（抽样）", () => {
    const flags = loadFlags();
    for (const k of [
      "infra-app", "infra-ui", "infra-nav-core", "infra-nav-url", "infra-sidebar",
      "pdf-annotation", "pdf-search", "pdf-quick-actions"
    ]) {
      expect(flags[k]).toBeDefined();
      expect(typeof flags[k].enabled).toBe("boolean");
    }
  });
});

