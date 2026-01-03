/**
 * 仅做 DOM 事件绑定（不包含业务逻辑），用于把 FilterBuilder 主文件收敛为装配层。
 */

/**
 * @param {object} params
 * @param {HTMLElement} params.container
 * @param {{ findNodeById:(id:string)=>any }} params.filterTree
 * @param {Function} params.closeMenusHandler
 * @param {(node:any)=>void} params.onSelectNode
 * @param {(nodeId:string)=>void} params.onDeleteNode
 * @param {(childNodeId:string)=>void} params.onDeleteInlineChild
 * @param {(nodeId:string)=>void} params.onToggleLogicSwitchMenu
 * @param {(nodeId:string,newLogic:string)=>void} params.onSwitchLogic
 */
export function bindFilterBuilderV2TreeDomEvents({
  container,
  filterTree,
  closeMenusHandler,
  onSelectNode,
  onDeleteNode,
  onDeleteInlineChild,
  onToggleLogicSwitchMenu,
  onSwitchLogic,
}) {
  container.querySelectorAll(".tree-node").forEach((nodeEl) => {
    nodeEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-delete-node")) {return;}

      const nodeId = nodeEl.dataset.nodeId;
      const node = filterTree.findNodeById(nodeId);
      if (node) {onSelectNode(node);}
    });
  });

  container.querySelectorAll(".inline-child").forEach((childEl) => {
    childEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (
        e.target.classList.contains("btn-delete-node") ||
        e.target.classList.contains("btn-delete-inline-child")
      ) {
        return;
      }

      const nodeId = childEl.dataset.nodeId;
      const node = filterTree.findNodeById(nodeId);
      if (node) {onSelectNode(node);}
    });
  });

  container.querySelectorAll(".btn-delete-node").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId;
      onDeleteNode(nodeId);
    });
  });

  container.querySelectorAll(".btn-delete-inline-child").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId;
      onDeleteInlineChild(nodeId);
    });
  });

  container.querySelectorAll(".switchable-logic-label").forEach((label) => {
    label.addEventListener("click", (e) => {
      e.stopPropagation();
      const nodeId = label.dataset.switchNodeId;
      onToggleLogicSwitchMenu(nodeId);
    });
  });

  container.querySelectorAll(".logic-switch-option").forEach((option) => {
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      const nodeId = option.dataset.nodeId;
      const switchTo = option.dataset.switchTo;
      onSwitchLogic(nodeId, switchTo);
    });
  });

  document.addEventListener("click", closeMenusHandler);
}

/**
 * @param {object} params
 * @param {HTMLElement} params.container
 * @param {()=>void} params.onCollapse
 * @param {(logicType:string)=>void} params.onAddLogic
 * @param {()=>void} params.onAddCondition
 * @param {()=>void} params.onReset
 * @param {()=>void} params.onApply
 */
export function installFilterBuilderV2ToolbarDomEvents({
  container,
  onCollapse,
  onAddLogic,
  onAddCondition,
  onReset,
  onApply,
}) {
  const collapseBtn = container.querySelector(".btn-collapse");
  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => onCollapse());
  }

  container.querySelectorAll(".btn-add-logic").forEach((btn) => {
    btn.addEventListener("click", () => {
      const logicType = btn.dataset.logic;
      onAddLogic(logicType);
    });
  });

  const addConditionBtn = container.querySelector(".btn-add-condition");
  if (addConditionBtn) {
    addConditionBtn.addEventListener("click", () => onAddCondition());
  }

  const resetBtn = container.querySelector(".btn-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => onReset());
  }

  const applyBtn = container.querySelector(".btn-apply");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => onApply());
  }
}

