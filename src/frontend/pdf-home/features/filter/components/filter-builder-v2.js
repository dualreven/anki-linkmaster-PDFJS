/**
 * 树状高级筛选构建器 (Version 2)
 * 支持逻辑词嵌套和树状结构
 *
 * 详细拆分说明：`docs/standards/filter-builder-v2.md`
 */

import { FilterTree, FilterTreeNode } from "../services/filter-tree.js";
import { showError, showInfo } from "../../../../common/utils/notification.js";
import { FILTER_EVENTS } from "../../../../common/event/event-constants.js";
import { ConditionEditor } from "./condition-editor.js";
import { getFilterBuilderV2Template } from "./filter-builder-v2-template.js";
import {
  FILTER_BUILDER_V2_FIELD_LABELS,
  FILTER_BUILDER_V2_OPERATOR_TO_SYMBOL,
} from "./filter-builder-v2-constants.js";
import { renderFilterBuilderV2Node } from "./filter-builder-v2-renderer.js";
import { buildConditionConfigFromFilterTreeRoot } from "./filter-builder-v2-serialization.js";
import {
  bindFilterBuilderV2TreeDomEvents,
  installFilterBuilderV2ToolbarDomEvents,
} from "./filter-builder-v2-dom-events.js";

export class FilterBuilder {
  #logger = null;
  #eventBus = null;
  #filterManager = null;
  #container = null;
  #filterTree = null;
  #selectedNode = null;
  #conditionEditor = null;
  #availableTags = [];
  #closeMenusHandler = null;

  constructor(logger, eventBus, filterManager) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#filterManager = filterManager;
    this.#filterTree = new FilterTree();
    this.#conditionEditor = new ConditionEditor(logger);
    this.#closeMenusHandler = this.#closeAllLogicMenus.bind(this);
  }

  /** 渲染到指定容器 */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = getFilterBuilderV2Template();
    this.#setupEventListeners();
    this.#renderTree();
    this.#logger.info("[FilterBuilder] Rendered");
  }

  /** 显示构建器 */
  show() {
    const builderElement = this.#container.querySelector(".filter-builder");
    if (builderElement) {
      builderElement.hidden = false;
      this.#loadAvailableTags();
      this.#renderTree();
      this.#updatePreview();
      this.#logger.info("[FilterBuilder] Shown");
    }
  }

  /** 加载可用标签 */
  #loadAvailableTags() {
    try {
      const dataSource = this.#filterManager.getDataSource();
      const tagsSet = new Set();

      dataSource.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach(tag => tagsSet.add(tag));
        }
      });

      this.#availableTags = Array.from(tagsSet).sort();
      this.#logger.debug("[FilterBuilder] Available tags loaded", {
        count: this.#availableTags.length
      });
    } catch (error) {
      this.#logger.error("[FilterBuilder] Failed to load tags", error);
      this.#availableTags = [];
    }
  }

  /** 隐藏构建器 */
  hide() {
    const builderElement = this.#container.querySelector(".filter-builder");
    if (builderElement) {
      builderElement.hidden = true;
      this.#logger.info("[FilterBuilder] Hidden");
    }
  }

  /** @returns {boolean} 是否可见 */
  isVisible() {
    const builderElement = this.#container.querySelector(".filter-builder");
    return builderElement ? !builderElement.hidden : false;
  }

  /** 渲染树状结构 */
  #renderTree() {
    const treeContainer = this.#container.querySelector("#filter-tree-container");
    if (!treeContainer) {return;}

    const rootNode = this.#filterTree.root;
    treeContainer.innerHTML = renderFilterBuilderV2Node({
      node: rootNode,
      depth: 0,
      selectedNodeId: this.#selectedNode ? this.#selectedNode.id : null,
      rootNodeId: rootNode.id,
      fieldLabels: FILTER_BUILDER_V2_FIELD_LABELS,
      operatorToSymbol: FILTER_BUILDER_V2_OPERATOR_TO_SYMBOL,
    });

    bindFilterBuilderV2TreeDomEvents({
      container: this.#container,
      filterTree: this.#filterTree,
      closeMenusHandler: this.#closeMenusHandler,
      onSelectNode: (node) => {
        this.#selectedNode = node;
        this.#renderTree();
        this.#logger.debug("[FilterBuilder] Node selected", { nodeId: node.id });
      },
      onDeleteNode: (nodeId) => this.#deleteNode(nodeId),
      onDeleteInlineChild: (nodeId) => this.#deleteInlineChild(nodeId),
      onToggleLogicSwitchMenu: (nodeId) => this.#toggleLogicSwitchMenu(nodeId),
      onSwitchLogic: (nodeId, switchTo) => this.#switchLogic(nodeId, switchTo),
    });

    // 更新工具栏按钮状态
    this.#updateToolbarButtons();
  }

  /**
   * 添加逻辑词节点
   */
  #addLogicNode(logicType) {
    if (!this.#selectedNode) {
      try { showError("请先选择一个节点", 3000); } catch (e) { try { this.#logger?.warn("[Toast] showError failed", e); } catch (e2) { void e2; } }
      return;
    }

    // 检查是否是根节点
    if (this.#isRootNode(this.#selectedNode)) {
      try { showInfo("根节点不能被替换，请选择根节点下的占位符来添加条件", 3500); } catch (e) { try { this.#logger?.warn("[Toast] showInfo failed", e); } catch (e2) { void e2; } }
      return;
    }

    // 检查父节点是否为NOT且已有子节点
    if (this.#selectedNode.type !== "placeholder") {
      const parent = this.#selectedNode.parent;
      if (parent && parent.value === "NOT") {
        const nonPlaceholderCount = parent.children.filter(c => c.type !== "placeholder").length;
        if (nonPlaceholderCount >= 1) {
          try { showError("NOT逻辑词只能包含一个条件或逻辑词", 3500); } catch (e) { try { this.#logger?.warn("[Toast] showError failed", e); } catch (e2) { void e2; } }
          return;
        }
      }
    }

    const newNode = new FilterTreeNode({
      type: "logic",
      value: logicType
    });

    // 添加占位符子节点
    newNode.addChild(new FilterTreeNode({
      type: "placeholder"
    }));

    if (this.#selectedNode.type === "placeholder") {
      // 替换占位符
      const parent = this.#selectedNode.parent;
      const index = this.#selectedNode.getIndexInParent();
      parent.removeChild(this.#selectedNode);
      parent.children.splice(index, 0, newNode);
      newNode.parent = parent;

      // 如果父节点是NOT，移除其他占位符
      if (parent.value === "NOT") {
        parent.children.filter(c => c.type === "placeholder" && c.id !== newNode.children[0].id)
          .forEach(c => parent.removeChild(c));
      } else {
        // 如果父节点是AND/OR，且还没有placeholder，添加一个
        if (!parent.children.some(c => c.type === "placeholder")) {
          parent.addChild(new FilterTreeNode({ type: "placeholder" }));
        }
      }
    } else {
      // 在选中节点后添加同级节点
      this.#selectedNode.insertSiblingAfter(newNode);
    }

    this.#selectedNode = newNode.children[0]; // 选中新的占位符
    this.#renderTree();
    this.#updatePreview();
  }

  /**
   * 添加条件节点
   */
  #addConditionNode() {
    if (!this.#selectedNode) {
      try { showError("请先选择一个节点", 3000); } catch (e) { try { this.#logger?.warn("[Toast] showError failed", e); } catch (e2) { void e2; } }
      return;
    }

    // 检查是否是根节点
    if (this.#isRootNode(this.#selectedNode)) {
      try { showInfo("根节点不能被替换，请选择根节点下的占位符来添加条件", 3500); } catch (e) { try { this.#logger?.warn("[Toast] showInfo failed", e); } catch (e2) { void e2; } }
      return;
    }

    // 检查父节点是否为NOT且已有子节点
    if (this.#selectedNode.type !== "placeholder") {
      const parent = this.#selectedNode.parent;
      if (parent && parent.value === "NOT") {
        const nonPlaceholderCount = parent.children.filter(c => c.type !== "placeholder").length;
        if (nonPlaceholderCount >= 1) {
          try { showError("NOT逻辑词只能包含一个条件或逻辑词", 3500); } catch (e) { try { this.#logger?.warn("[Toast] showError failed", e); } catch (e2) { void e2; } }
          return;
        }
      }
    }

    // 显示条件编辑对话框
    this.#showConditionDialog((conditionData) => {
      const newNode = new FilterTreeNode({
        type: "condition",
        value: conditionData
      });

      if (this.#selectedNode.type === "placeholder") {
        // 替换占位符
        const parent = this.#selectedNode.parent;
        const index = this.#selectedNode.getIndexInParent();
        parent.removeChild(this.#selectedNode);
        parent.children.splice(index, 0, newNode);
        newNode.parent = parent;

        // 如果父节点还没有占位符，添加一个（但NOT只能有一个子节点）
        if (parent.value !== "NOT" && !parent.children.some(c => c.type === "placeholder")) {
          parent.addChild(new FilterTreeNode({ type: "placeholder" }));
        }
      } else {
        // 在选中节点后添加同级节点
        this.#selectedNode.insertSiblingAfter(newNode);
      }

      this.#selectedNode = null;
      this.#renderTree();
      this.#updatePreview();
    });
  }

  /**
   * 显示条件编辑对话框
   */
  #showConditionDialog(callback) {
    // 更新可用标签
    this.#conditionEditor.setAvailableTags(this.#availableTags);
    // 显示编辑器
    this.#conditionEditor.show(callback);
  }

  /**
   * 删除节点
   */
  #deleteNode(nodeId) {
    const node = this.#filterTree.findNodeById(nodeId);
    if (!node || !node.parent) {
      try { showInfo("无法删除根节点", 3000); } catch (e) { try { this.#logger?.warn("[Toast] showInfo failed", e); } catch (e2) { void e2; } }
      return;
    }

    const parent = node.parent;

    // 删除节点
    parent.removeChild(node);

    // 如果父节点没有子节点了，添加占位符
    if (parent.children.length === 0) {
      parent.addChild(new FilterTreeNode({ type: "placeholder" }));
      this.#logger.debug("[FilterBuilder] Added placeholder after deleting last child");
    } else {
      // 如果父节点还有子节点，但没有placeholder（且不是NOT节点），也要添加一个
      const hasPlaceholder = parent.children.some(c => c.type === "placeholder");
      const isNotNode = parent.value === "NOT";

      if (!hasPlaceholder && !isNotNode) {
        parent.addChild(new FilterTreeNode({ type: "placeholder" }));
        this.#logger.debug("[FilterBuilder] Added placeholder to maintain availability");
      }
    }

    this.#selectedNode = null;
    this.#renderTree();
    this.#updatePreview();
  }

  /**
   * 切换逻辑节点菜单显示/隐藏
   */
  #toggleLogicSwitchMenu(nodeId) {
    // 先关闭所有菜单
    this.#closeAllLogicMenus();

    // 切换当前菜单
    const menu = this.#container.querySelector(`.logic-switch-menu[data-menu-for="${nodeId}"]`);
    if (menu) {
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    }
  }

  /**
   * 关闭所有逻辑节点菜单
   */
  #closeAllLogicMenus() {
    this.#container.querySelectorAll(".logic-switch-menu").forEach(menu => {
      menu.style.display = "none";
    });
  }

  /**
   * 切换逻辑运算符（AND <-> OR）
   */
  #switchLogic(nodeId, newLogic) {
    const node = this.#filterTree.findNodeById(nodeId);
    if (!node || node.type !== "logic") {
      this.#logger.warn("[FilterBuilder] Cannot switch logic: not a logic node");
      return;
    }

    // NOT节点不能切换
    if (node.value === "NOT") {
      this.#logger.warn("[FilterBuilder] Cannot switch NOT node");
      return;
    }

    this.#logger.info(`[FilterBuilder] Switching logic from ${node.value} to ${newLogic}`);

    // 更新节点值
    node.value = newLogic;

    // 关闭菜单
    this.#closeAllLogicMenus();

    // 重新渲染
    this.#renderTree();
    this.#updatePreview();
  }

  /**
   * 删除NOT内联子节点（保留NOT节点本身）
   */
  #deleteInlineChild(childNodeId) {
    const childNode = this.#filterTree.findNodeById(childNodeId);
    if (!childNode || !childNode.parent) {
      this.#logger.warn("[FilterBuilder] Cannot delete inline child node");
      return;
    }

    const notNode = childNode.parent;

    // 删除子节点
    notNode.removeChild(childNode);

    // NOT节点下必须添加placeholder
    if (!notNode.children.some(c => c.type === "placeholder")) {
      notNode.addChild(new FilterTreeNode({ type: "placeholder" }));
      this.#logger.debug("[FilterBuilder] Added placeholder to NOT after deleting child");
    }

    this.#selectedNode = null;
    this.#renderTree();
    this.#updatePreview();
  }

  /**
   * 更新预览
   */
  #updatePreview() {
    const previewEl = this.#container.querySelector("#python-preview");
    if (!previewEl) {return;}

    const expression = this.#filterTree.toPythonExpression();
    previewEl.textContent = expression || "无条件";
  }

  /**
   * 检查节点是否是根节点
   */
  #isRootNode(node) {
    return node && node.id === this.#filterTree.root.id;
  }

  /**
   * 更新工具栏按钮状态
   */
  #updateToolbarButtons() {
    const isRootSelected = this.#selectedNode && this.#isRootNode(this.#selectedNode);
    const noSelection = !this.#selectedNode;

    // 禁用/启用逻辑词按钮
    this.#container.querySelectorAll(".btn-add-logic").forEach(btn => {
      btn.disabled = isRootSelected || noSelection;
      if (isRootSelected || noSelection) {
        btn.classList.add("disabled");
        btn.title = isRootSelected ? "根节点不能被替换" : "请先选择一个节点";
      } else {
        btn.classList.remove("disabled");
        btn.title = `添加 ${btn.dataset.logic} 逻辑词`;
      }
    });

    // 禁用/启用条件按钮
    const addConditionBtn = this.#container.querySelector(".btn-add-condition");
    if (addConditionBtn) {
      addConditionBtn.disabled = isRootSelected || noSelection;
      if (isRootSelected || noSelection) {
        addConditionBtn.classList.add("disabled");
        addConditionBtn.title = isRootSelected ? "根节点不能被替换" : "请先选择一个节点";
      } else {
        addConditionBtn.classList.remove("disabled");
        addConditionBtn.title = "添加筛选条件";
      }
    }
  }

  /** 重置 */
  #reset() {
    this.#filterTree = new FilterTree();
    this.#selectedNode = null;
    this.#renderTree();
    this.#updatePreview();
  }

  /** 应用筛选 */
  applyFilter() {
    this.#logger.info("[FilterBuilder] Applying filter");
    // 构建可序列化的条件配置（与后端 SearchCondition 格式兼容）
    const config = this.getConditionConfig();
    try {
      this.#logger?.debug?.("[FilterBuilder] Built Condition Config", config);
    } catch (e) {
      // logger-guard
      void e;
    }
    // 通知 Feature 层：条件已构建
    try {
      this.#eventBus?.emit(FILTER_EVENTS.APPLY.COMPLETED, { condition: config });
    } catch (e) {
      // logger-guard
      void e;
    }
    // 仅隐藏面板，实际发送由上层 Feature 执行
    this.hide();
  }

  /**
   * 获取当前条件配置（转换为后端可识别的结构）
   * @returns {Object} 条件配置
   */
  getConditionConfig() {
    return buildConditionConfigFromFilterTreeRoot(this.#filterTree.root);
  }

  /**
   * 设置事件监听
   */
  #setupEventListeners() {
    installFilterBuilderV2ToolbarDomEvents({
      container: this.#container,
      onCollapse: () => this.hide(),
      onAddLogic: (logicType) => this.#addLogicNode(logicType),
      onAddCondition: () => this.#addConditionNode(),
      onReset: () => this.#reset(),
      onApply: () => this.applyFilter(),
    });
  }

  /**
   * 销毁组件
   */
  destroy() {
    // 移除全局事件监听器
    if (this.#closeMenusHandler) {
      document.removeEventListener("click", this.#closeMenusHandler);
    }

    if (this.#container) {
      this.#container.innerHTML = "";
    }
    this.#logger.info("[FilterBuilder] Destroyed");
  }
}

