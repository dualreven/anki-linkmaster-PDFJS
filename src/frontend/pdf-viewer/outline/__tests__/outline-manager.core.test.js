/**
 * 目的：覆盖 OutlineManager 的核心行为（不依赖 UI 与 WS）
 * - importNativeOutline：树映射与 id 生成
 * - add/update/delete/reorder：基本 CRUD 与树结构移动
 * - saveToStorage/loadFromStorage：本地存储读写（基于 ?pdf-id）
 */
import { EventBus } from "../../../common/event/event-bus.js";
import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import OutlineManager from "../outline-manager.js";

describe("OutlineManager 核心能力", () => {
  async function makeScopedBus() {
    const global = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../common/event/scoped-event-bus.js");
    return new ScopedEventBus(global, "pdf-viewer");
  }

  test("importNativeOutline 应生成稳定 id 且保留层级", async () => {
    const bus = await makeScopedBus();
    const om = new OutlineManager(bus, { disableAutoLoad: true });
    om.initialize();
    const native = [
      { title: "A", dest: [1], items: [{ title: "A-1", dest: [1], items: [] }] },
      { title: "B", dest: [2], items: [] }
    ];
    const parsed = { pageAt: 1, position: 25 };
    const res = await om.importNativeOutline(native, async () => parsed);
    expect(res.success).toBe(true);
    const all = om.getAllOutlineItems();
    expect(all.length).toBe(2);
    expect(all[0].name).toBe("A");
    expect(all[0].children[0].name).toBe("A-1");
    // id 形如 outlineItem-XXXXXXXX（8位十六进制）
    expect(all[0].id).toMatch(/^outlineItem-[0-9A-F]{8}$/);
    expect(all[0].children[0].id).toMatch(/^outlineItem-[0-9A-F]{8}$/);
    // 解析结果透传
    expect(all[0].pageAt).toBe(1);
    expect(all[0].position).toBe(25);
  });

  test("add/update/delete 行为正确（含子树删除）", async () => {
    const bus = await makeScopedBus();
    const om = new OutlineManager(bus, { disableAutoLoad: true });
    om.initialize();
    // 新增根
    const r1 = await om.addOutlineItem({ name: "root", pageAt: 1, position: 10 });
    expect(r1.success).toBe(true);
    const rootId = r1.id;
    // 新增子
    const r2 = await om.addOutlineItem({ name: "child", pageAt: 2, position: null, parentId: rootId });
    expect(r2.success).toBe(true);
    // 更新
    const u1 = await om.updateOutlineItem(rootId, { name: "root2", pageAt: 3, position: 99.9 });
    expect(u1.success).toBe(true);
    expect(om.getOutlineItem(rootId).name).toBe("root2");
    expect(om.getOutlineItem(rootId).pageAt).toBe(3);
    expect(om.getOutlineItem(rootId).position).toBe(100);
    // 删除父即级联删除
    const d1 = await om.deleteOutlineItem(rootId, true);
    expect(d1.success).toBe(true);
    expect(om.getAllOutlineItems().length).toBe(0);
  });

  test("reorder 可将节点移动到根级或指定父节点", async () => {
    const bus = await makeScopedBus();
    const om = new OutlineManager(bus, { disableAutoLoad: true });
    om.initialize();
    // 造一棵树：A, B; A 有 A1
    const A = (await om.addOutlineItem({ name: "A", pageAt: 1, position: 0 })).id;
    const B = (await om.addOutlineItem({ name: "B", pageAt: 2, position: 0 })).id;
    const A1 = (await om.addOutlineItem({ name: "A1", pageAt: 1, position: 0, parentId: A })).id;
    // 将 A1 移到根级 index=1
    const r1 = await om.reorderOutlineItems(A1, null, 1);
    expect(r1.success).toBe(true);
    const roots = om.getAllOutlineItems();
    expect(roots.map(n => n.name)).toEqual(["A", "A1", "B"]);
    // 再将 A1 移到 B 作为第0个子
    const r2 = await om.reorderOutlineItems(A1, B, 0);
    expect(r2.success).toBe(true);
    const now = om.getAllOutlineItems();
    expect(now[1].name).toBe("B");
    expect(now[1].children[0].name).toBe("A1");
  });

  test("saveToStorage/loadFromStorage 与 URL pdf-id 绑定", async () => {
    const bus = await makeScopedBus();
    const om = new OutlineManager(bus, { disableAutoLoad: true });
    om.initialize();
    try { window.history.pushState({}, "", "?pdf-id=unit-om"); } catch {}
    // 写入
    const id = (await om.addOutlineItem({ name: "X", pageAt: 5, position: 12 })).id;
    await om.saveToStorage();
    // 清空内存并从存储恢复
    await om.replaceFromRemote([]);
    expect(om.getAllOutlineItems().length).toBe(0);
    await om.loadFromStorage();
    const items = om.getAllOutlineItems();
    expect(items.length).toBe(1);
    expect(items[0].name).toBe("X");
    expect(items[0].id).toBe(id);
  });

  test("loadOutline 在无 pdfDocument 时发布 EMPTY 或 SUCCESS(storage)", async () => {
    const busGlobal = new EventBus({ moduleName: "TestBus", enableValidation: true, logger: getLogger("test") });
    const { ScopedEventBus } = await import("../../../common/event/scoped-event-bus.js");
    const bus = new ScopedEventBus(busGlobal, "pdf-viewer");
    const om = new OutlineManager(bus, { disableAutoLoad: false }); // 允许自动订阅
    om.initialize();
    try { window.history.pushState({}, "", "?pdf-id=no-doc"); } catch {}
    // 先存一份，触发时应从 storage 发 SUCCESS
    await om.replaceFromRemote([{ id: "k1", name: "K", pageAt: 1, position: null, children: [] }]);
    await om.saveToStorage();
    // 订阅渲染
    let got = null;
    bus.onGlobal(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, (d) => { got = d; }, { subscriberId: "test" });
    // 触发自动加载
    await om.loadOutline();
    expect(got).not.toBeNull();
    expect(Array.isArray(got.outlineItems)).toBe(true);
    expect(got.outlineItems.length).toBe(1);
  });
});
