const INDENT_PX = 24;

/**
 * @param {object} params
 * @param {import("../services/filter-tree.js").FilterTreeNode} params.node
 * @param {Record<string,string>} params.fieldLabels
 * @param {Record<string,string>} params.operatorToSymbol
 * @param {boolean} [params.stripOuterParens=false]
 * @returns {string}
 */
export function getFilterBuilderV2NodeContentText({
  node,
  fieldLabels,
  operatorToSymbol,
  stripOuterParens = false,
}) {
  if (node.type === "condition") {
    const { field, operator, value } = node.value;
    const fieldLabel = fieldLabels[field] || field;
    const operatorSymbol = operatorToSymbol[operator] || operator;
    return `${fieldLabel} ${operatorSymbol} "${value}"`;
  }

  if (node.type === "logic") {
    const childTexts = node.children
      .filter((child) => child.type !== "placeholder")
      .map((child) => getFilterBuilderV2NodeContentText({ node: child, fieldLabels, operatorToSymbol }))
      .join(node.value === "AND" ? " AND " : " OR ");

    if (stripOuterParens) {
      return childTexts;
    }

    return `(${childTexts})`;
  }

  return "";
}

/**
 * @param {import("../services/filter-tree.js").FilterTreeNode} node
 * @returns {string}
 */
function renderLogicSwitchMenu(node) {
  const oppositeLogic = node.value === "AND" ? "OR" : "AND";
  return `
      <div class="logic-switch-menu" data-menu-for="${node.id}" style="display: none;">
        <div class="logic-switch-option" data-switch-to="${oppositeLogic}" data-node-id="${node.id}">
          切换为 ${oppositeLogic}
        </div>
      </div>
    `;
}

/**
 * @param {object} params
 * @param {import("../services/filter-tree.js").FilterTreeNode} params.node
 * @param {number} params.depth
 * @param {string|null} params.selectedNodeId
 * @param {string} params.rootNodeId
 * @param {Record<string,string>} params.fieldLabels
 * @param {Record<string,string>} params.operatorToSymbol
 * @returns {string}
 */
export function renderFilterBuilderV2Node({
  node,
  depth,
  selectedNodeId,
  rootNodeId,
  fieldLabels,
  operatorToSymbol,
}) {
  const indent = depth * INDENT_PX;
  const isSelected = Boolean(selectedNodeId) && selectedNodeId === node.id;

  if (node.type === "logic") {
    if (node.value === "NOT") {
      const child = node.children.find((c) => c.type !== "placeholder");
      const placeholder = node.children.find((c) => c.type === "placeholder");

      if (child) {
        const childContent = getFilterBuilderV2NodeContentText({
          node: child,
          fieldLabels,
          operatorToSymbol,
          stripOuterParens: true,
        });
        const childSelected = Boolean(selectedNodeId) && selectedNodeId === child.id;

        return `
            <div class="tree-node logic-node not-inline ${isSelected ? "selected" : ""}"
                 data-node-id="${node.id}"
                 style="margin-left: ${indent}px">
              <div class="node-content">
                <span class="logic-label">NOT:</span>
                <span class="inline-child ${childSelected ? "child-selected" : ""}"
                      data-node-id="${child.id}">
                  ${childContent}
                  <button class="btn-delete-inline-child" data-node-id="${child.id}" title="删除此条件">×</button>
                </span>
                <button class="btn-delete-node" data-node-id="${node.id}" title="删除整个NOT">🗑️</button>
              </div>
            </div>
          `;
      }

      if (placeholder) {
        const placeholderSelected = Boolean(selectedNodeId) && selectedNodeId === placeholder.id;
        return `
            <div class="tree-node logic-node not-inline ${isSelected ? "selected" : ""}"
                 data-node-id="${node.id}"
                 style="margin-left: ${indent}px">
              <div class="node-content">
                <span class="logic-label">NOT:</span>
                <span class="inline-child placeholder-inline ${placeholderSelected ? "child-selected" : ""}"
                      data-node-id="${placeholder.id}">
                  [ 点击选中，然后添加逻辑词或条件 ]
                </span>
                <button class="btn-delete-node" data-node-id="${node.id}" title="删除">🗑️</button>
              </div>
            </div>
          `;
      }
    }

    const childrenHTML = node.children
      .map((child) =>
        renderFilterBuilderV2Node({
          node: child,
          depth: depth + 1,
          selectedNodeId,
          rootNodeId,
          fieldLabels,
          operatorToSymbol,
        }),
      )
      .join("");

    const isRoot = node.id === rootNodeId;
    const deleteBtn = !isRoot
      ? `<button class="btn-delete-node" data-node-id="${node.id}" title="删除">🗑️</button>`
      : "";

    return `
        <div class="tree-node logic-node logic-switchable ${isSelected ? "selected" : ""}"
             data-node-id="${node.id}"
             style="margin-left: ${indent}px">
          <div class="node-content">
            <span class="logic-label switchable-logic-label"
                  data-switch-node-id="${node.id}">
              ${node.value}: ▼
            </span>
            ${deleteBtn}
          </div>
          ${renderLogicSwitchMenu(node)}
        </div>
        ${childrenHTML}
      `;
  }

  if (node.type === "condition") {
    const { field, operator, value } = node.value;
    const fieldLabel = fieldLabels[field] || field;
    const operatorSymbol = operatorToSymbol[operator] || operator;

    return `
        <div class="tree-node condition-node ${isSelected ? "selected" : ""}"
             data-node-id="${node.id}"
             style="margin-left: ${indent}px">
          <div class="node-content">
            <span class="condition-text">
              ${fieldLabel} ${operatorSymbol} "${value}"
            </span>
            <button class="btn-delete-node" data-node-id="${node.id}" title="删除">🗑️</button>
          </div>
        </div>
      `;
  }

  if (node.type === "placeholder") {
    return `
        <div class="tree-node placeholder-node ${isSelected ? "selected" : ""}"
             data-node-id="${node.id}"
             style="margin-left: ${indent}px">
          <div class="node-content">
            <span class="placeholder-text">[ 点击选中，然后添加逻辑词或条件 ]</span>
          </div>
        </div>
      `;
  }

  return "";
}

