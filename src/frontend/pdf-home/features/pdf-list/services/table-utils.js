/**
 * @file Tabulator 工具函数（最小桩实现）
 */

export class TableUtils {
  static prepareData(data) {
    try {
      if (!Array.isArray(data)) return [];
      return data.map((it, idx) => ({
        ...it,
        id: it?.id || it?.filename || `row_${idx}_${Date.now()}`
      }));
    } catch (_) {
      return [];
    }
  }

  static ensureTabulatorRedraw(_tabulator) {}
  static logDOMDiagnostics(_wrapper, _tabulator) {}
  static handleMissingDOMElements(_wrapper, _tabulator) {}
  static logComputedStyles(_parent, _wrapper) {}
  static logTabulatorInstanceInfo(_tabulator) {}
}

export default TableUtils;

