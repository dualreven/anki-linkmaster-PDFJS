function assertIsNonEmptyString(value, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
}

function normalizePageAt(pageAt) {
  return Number.isInteger(pageAt) && pageAt > 0 ? pageAt : 1;
}

function normalizePosition(position) {
  if (position === null || position === undefined) { return null; }
  if (typeof position !== "number" || Number.isNaN(position) || !Number.isFinite(position)) { return null; }
  return Math.max(0, Math.min(100, Math.round(position)));
}

/**
 * 将大纲树结构转换为 bulk-save 的扁平 items
 * - 为每个节点分配 outline_id（通过 generateOutlineId）
 * - 输出包含 parent_id/order 以维护父子关系与顺序
 * @param {Array<{id:string,name?:string,pageAt?:number,position?:number|null,children?:any[]}>} items
 * @param {Object} deps
 * @param {() => string} deps.generateOutlineId
 * @returns {Array<{outline_id:string,name:string,page_at:number,position:number|null,parent_id:string|null,order:number}>}
 */
export function flattenOutlineTreeForBulkSave(items, { generateOutlineId }) {
  if (!Array.isArray(items)) {
    throw new Error("[OutlineBulkSaveFlattener] items must be an array");
  }
  if (typeof generateOutlineId !== "function") {
    throw new Error("[OutlineBulkSaveFlattener] generateOutlineId must be a function");
  }

  const idMap = new Map(); // temp id -> outline_id
  const assign = (arr) => {
    for (const node of (arr || [])) {
      assertIsNonEmptyString(node?.id, "[OutlineBulkSaveFlattener] node.id must be a non-empty string");
      if (idMap.has(node.id)) {
        throw new Error(`[OutlineBulkSaveFlattener] duplicate node.id: ${node.id}`);
      }
      const outlineId = generateOutlineId();
      assertIsNonEmptyString(outlineId, "[OutlineBulkSaveFlattener] generateOutlineId must return a non-empty string");
      idMap.set(node.id, outlineId);
      assign(node.children || []);
    }
  };
  assign(items);

  const flat = [];
  const walk = (arr, parentTempId) => {
    for (let i = 0; i < (arr || []).length; i++) {
      const node = arr[i];
      assertIsNonEmptyString(node?.id, "[OutlineBulkSaveFlattener] node.id must be a non-empty string");
      const outlineId = idMap.get(node.id);
      assertIsNonEmptyString(outlineId, "[OutlineBulkSaveFlattener] internal error: missing mapped outline_id");

      flat.push({
        outline_id: outlineId,
        name: String(node?.name || "").trim(),
        page_at: normalizePageAt(node?.pageAt),
        position: normalizePosition(node?.position),
        parent_id: parentTempId ? idMap.get(parentTempId) : null,
        order: i
      });

      walk(node.children || [], node.id);
    }
  };
  walk(items, null);

  return flat;
}

