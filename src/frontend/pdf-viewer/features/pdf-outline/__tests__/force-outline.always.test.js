/**
 * 说明：
 * - 本测试占位用于声明“自 2025-10-25 起，pdf-viewer 启动时始终装配 Outline”
 * - 由于当前测试运行环境未完整模拟窗口/容器/事件总线，先以 skip 形式落档，防止误报。
 * - 验收点（未来启用时）：
 *   1) bootstrapPDFViewerAppFeature() 返回的 registry 中存在 name === 'pdf-outline'
 *   2) registry 中不存在 name === 'pdf-bookmark'
 */
describe.skip("Bootstrap 应始终装配 Outline（废止 Bookmark）", () => {
  test("注册记录包含 pdf-outline，不包含 pdf-bookmark", async () => {
    const { bootstrapPDFViewerAppFeature } = await import("../../../../pdf-viewer/bootstrap/app-bootstrap-feature.js");
    const registry = await bootstrapPDFViewerAppFeature();
    const names = registry.list().map(r => r.name);
    expect(names).toContain("pdf-outline");
    expect(names).not.toContain("pdf-bookmark");
  });
});

