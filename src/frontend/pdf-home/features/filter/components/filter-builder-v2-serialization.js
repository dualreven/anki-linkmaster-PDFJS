/**
 * 将 FilterTree 的 root 节点转换为后端可识别的 SearchCondition 结构。
 *
 * 注意：该转换逻辑原本内联在 FilterBuilder.getConditionConfig() 中。
 * 这里抽离为纯函数，方便单元测试与复用。
 */

/**
 * @param {import("../services/filter-tree.js").FilterTreeNode|null} node
 * @returns {object|null}
 */
export function nodeToConditionConfig(node) {
  if (!node) {return null;}

  if (node.type === "logic") {
    const children = (node.children || [])
      .filter((child) => child && child.type !== "placeholder")
      .map((child) => nodeToConditionConfig(child))
      .filter(Boolean);

    if (children.length === 0) {return null;}

    return {
      type: "composite",
      operator: node.value,
      conditions: children,
    };
  }

  if (node.type === "condition") {
    const { field, operator, value } = node.value || {};
    if (!field || !operator) {return null;}

    return {
      type: "field",
      field,
      operator,
      value,
    };
  }

  return null;
}

/**
 * @param {import("../services/filter-tree.js").FilterTreeNode|null} root
 * @returns {object} 条件配置（保证返回 composite AND 结构）
 */
export function buildConditionConfigFromFilterTreeRoot(root) {
  const cfg = nodeToConditionConfig(root);
  return cfg || { type: "composite", operator: "AND", conditions: [] };
}

