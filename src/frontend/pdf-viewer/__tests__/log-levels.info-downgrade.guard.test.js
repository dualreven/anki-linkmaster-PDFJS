/**
 * 目的：保障“实为 info 的告警”已降级为 info，避免回归到 warn。
 * 方法：静态扫描源码关键语句，校验使用 logger.info / this.#logger.info 而非 warn。
 */
import fs from "fs";
import path from "path";

const read = (p) => fs.readFileSync(p, { encoding: "utf-8" });

describe("日志级别降噪（info 代替 warn）", () => {
  test("Bootstrap 相关信息以 info 输出（非 warn）", () => {
    const p = path.resolve(__dirname, "../bootstrap/app-bootstrap-feature.js");
    const content = read(p);
    const msgs = [
      "[Bootstrap] Outline feature enforced; pdf-outline registered (legacy disabled)",
      "[TRACE] Skip Bootstrap auto-load because 'pdf-id' present; URLNavigationFeature will handle loading.",
      "[Bootstrap] Outline mode is active (enforced)",
    ];
    for (const m of msgs) {
      expect(content).toContain(m);
      expect(content.includes(`logger.warn("${m}`)).toBe(false);
      expect(content.includes(`logger.info("${m}`)).toBe(true);
    }
  });

  test("URLNavigationFeature TRACE 以 info 输出（非 warn）", () => {
    const p = path.resolve(__dirname, "../features/infra-nav-url/index.js");
    const content = read(p);
    const m = "[TRACE] Emitting FILE.LOAD.REQUESTED from URLNavigationFeature";
    expect(content).toContain(m);
    expect(content.includes(`this.#logger.warn("${m}`)).toBe(false);
    expect(content.includes(`this.#logger.info("${m}`)).toBe(true);
  });

  test("UI 容器缺失与 TextLayer 禁用为 info（非 warn）", () => {
    const p1 = path.resolve(__dirname, "../ui/dom-element-manager.js");
    const c1 = read(p1);
    expect(c1.includes('this.#logger.info("Container element not found, will create one")')).toBe(true);
    expect(c1.includes('this.#logger.warn("Container element not found, will create one")')).toBe(false);

    const p2 = path.resolve(__dirname, "../features/infra-ui/components/ui-manager-core.js");
    const c2 = read(p2);
    expect(c2.includes('this.#logger.info("TextLayer container not found, text layer disabled")')).toBe(true);
    expect(c2.includes('this.#logger.warn("TextLayer container not found, text layer disabled")')).toBe(false);
  });

  test("OutlineUI 无大纲提示为 info（非 warn）", () => {
    const p = path.resolve(__dirname, "../features/pdf-outline/components/outline-sidebar-ui.js");
    const content = read(p);
    const m = "[OutlineUI] 当前无大纲（可通过＋创建或自动导入）";
    expect(content.includes(`this.#logger.info("${m}`)).toBe(true);
    expect(content.includes(`this.#logger.warn("${m}`)).toBe(false);
  });
});

