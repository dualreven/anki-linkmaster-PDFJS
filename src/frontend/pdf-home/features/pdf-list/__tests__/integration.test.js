/**
 * @file PDFListFeature 集成测试
 * @description 验证 PDFListFeature 的核心功能和架构集成
 */

import { PDFListFeature } from "../index.js";
import { LIST_STATE_SCHEMA, ListStateHelpers } from "../state/list-state.js";
import { PDF_LIST_EVENTS, EventDataFactory } from "../events.js";
import { ListDataService } from "../services/list-data-service.js";
import { ListLifecycleService } from "../services/list-lifecycle-service.js";
import { PDFList } from "../components/pdf-table.js";

describe("PDFListFeature Integration Tests", () => {
  describe("模块导入测试", () => {
    test("PDFListFeature 类应该可导入", () => {
      expect(PDFListFeature).toBeDefined();
      expect(typeof PDFListFeature).toBe("function");
    });

    test("状态管理模块应该可导入", () => {
      expect(LIST_STATE_SCHEMA).toBeDefined();
      expect(ListStateHelpers).toBeDefined();
      expect(typeof LIST_STATE_SCHEMA).toBe("object");
    });

    test("事件模块应该可导入", () => {
      expect(PDF_LIST_EVENTS).toBeDefined();
      expect(EventDataFactory).toBeDefined();
      expect(typeof PDF_LIST_EVENTS).toBe("object");
    });

    test("服务层模块应该可导入", () => {
      expect(ListDataService).toBeDefined();
      expect(ListLifecycleService).toBeDefined();
    });

    test("组件层模块应该可导入", () => {
      expect(PDFList).toBeDefined();
      expect(typeof PDFList).toBe("function");
    });
  });

  describe("PDFListFeature 基本功能", () => {
    let feature;

    beforeEach(() => {
      feature = new PDFListFeature();
    });

    test("功能域应该有正确的名称", () => {
      expect(feature.name).toBe("pdf-list");
    });

    test("功能域应该有版本号", () => {
      expect(feature.version).toBeDefined();
      expect(typeof feature.version).toBe("string");
    });

    test("功能域应该有依赖列表", () => {
      expect(Array.isArray(feature.dependencies)).toBe(true);
    });

    test("功能域应该有 install 方法", () => {
      expect(typeof feature.install).toBe("function");
    });

    test("功能域应该有 uninstall 方法", () => {
      expect(typeof feature.uninstall).toBe("function");
    });

    test("功能域应该有公开方法", () => {
      expect(typeof feature.refreshList).toBe("function");
      expect(typeof feature.getSelectedRecords).toBe("function");
      expect(typeof feature.setFilters).toBe("function");
    });
  });

  describe("状态管理测试", () => {
    test("LIST_STATE_SCHEMA 应该有必要的字段", () => {
      expect(LIST_STATE_SCHEMA.items).toBeDefined();
      expect(LIST_STATE_SCHEMA.selectedIndices).toBeDefined();
      expect(LIST_STATE_SCHEMA.isLoading).toBeDefined();
      expect(LIST_STATE_SCHEMA.sortColumn).toBeDefined();
      expect(LIST_STATE_SCHEMA.sortDirection).toBeDefined();
      expect(LIST_STATE_SCHEMA.filters).toBeDefined();
      expect(LIST_STATE_SCHEMA.columnConfig).toBeDefined();
      expect(LIST_STATE_SCHEMA.pagination).toBeDefined();
    });

    test("ListStateHelpers 应该有所有辅助方法", () => {
      expect(typeof ListStateHelpers.addItem).toBe("function");
      expect(typeof ListStateHelpers.removeItem).toBe("function");
      expect(typeof ListStateHelpers.updateItem).toBe("function");
      expect(typeof ListStateHelpers.setLoading).toBe("function");
      expect(typeof ListStateHelpers.setError).toBe("function");
      expect(typeof ListStateHelpers.setSelectedIndices).toBe("function");
      expect(typeof ListStateHelpers.toggleSort).toBe("function");
      expect(typeof ListStateHelpers.setFilters).toBe("function");
      expect(typeof ListStateHelpers.resetFilters).toBe("function");
      expect(typeof ListStateHelpers.updateColumnConfig).toBe("function");
      expect(typeof ListStateHelpers.setPagination).toBe("function");
    });
  });

  describe("事件系统测试", () => {
    test("PDF_LIST_EVENTS 应该定义所有必要的事件", () => {
      // 数据加载事件
      expect(PDF_LIST_EVENTS.DATA_LOAD_REQUESTED).toBeDefined();
      expect(PDF_LIST_EVENTS.DATA_LOAD_STARTED).toBeDefined();
      expect(PDF_LIST_EVENTS.DATA_LOAD_COMPLETED).toBeDefined();
      expect(PDF_LIST_EVENTS.DATA_LOAD_FAILED).toBeDefined();

      // PDF操作事件
      expect(PDF_LIST_EVENTS.PDF_ADD_REQUESTED).toBeDefined();
      expect(PDF_LIST_EVENTS.PDF_REMOVE_REQUESTED).toBeDefined();
      expect(PDF_LIST_EVENTS.PDF_UPDATE_REQUESTED).toBeDefined();

      // 选择事件
      expect(PDF_LIST_EVENTS.ROW_SELECTED).toBeDefined();
      expect(PDF_LIST_EVENTS.SELECTION_CHANGED).toBeDefined();

      // 交互事件
      expect(PDF_LIST_EVENTS.ROW_CLICKED).toBeDefined();
      expect(PDF_LIST_EVENTS.ROW_DOUBLE_CLICKED).toBeDefined();

      // 生命周期事件
      expect(PDF_LIST_EVENTS.TABLE_INITIALIZED).toBeDefined();
      expect(PDF_LIST_EVENTS.TABLE_READY).toBeDefined();
      expect(PDF_LIST_EVENTS.TABLE_DESTROYED).toBeDefined();
    });

    test("EventDataFactory 应该有所有工厂方法", () => {
      expect(typeof EventDataFactory.createDataLoadedData).toBe("function");
      expect(typeof EventDataFactory.createSelectionChangedData).toBe("function");
      expect(typeof EventDataFactory.createRowClickedData).toBe("function");
      expect(typeof EventDataFactory.createErrorData).toBe("function");
      expect(typeof EventDataFactory.createSortChangedData).toBe("function");
      expect(typeof EventDataFactory.createFilterChangedData).toBe("function");
    });

    test("EventDataFactory 创建的数据应该包含 timestamp", () => {
      const data = EventDataFactory.createDataLoadedData([], 0);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe("number");
    });
  });

  describe("服务层测试", () => {
    test('ListDataService 应该正确标记为废弃', () => {
      const dataService = new ListDataService({ state: null, eventBus: null });
      const status = dataService.getStatus();
      expect(status.deprecated).toBe(true);
      expect(status.message).toContain('deprecated');
    });

    test('ListLifecycleService 应该正确标记为废弃', () => {
      const lifecycleService = new ListLifecycleService();
      const status = lifecycleService.getLifecycleStatus();
      expect(status.deprecated).toBe(true);
      expect(status.message).toContain('deprecated');
    });
  });
});

// 导出以便手动测试
if (typeof window !== "undefined") {
  window.PDFListFeatureTests = {
    PDFListFeature,
    LIST_STATE_SCHEMA,
    ListStateHelpers,
    PDF_LIST_EVENTS,
    EventDataFactory,
    ListDataService,
    ListLifecycleService,
    PDFList
  };

  // ✅ PDFListFeature 测试模块已加载到 window.PDFListFeatureTests
}
