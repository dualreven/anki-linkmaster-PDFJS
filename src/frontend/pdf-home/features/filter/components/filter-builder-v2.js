/**
 * 树状高级筛选构建器 (Version 2)
 * 支持逻辑词嵌套和树状结构
 */

import { FilterTree, FilterTreeNode } from "../services/filter-tree.js";
import { showError, showInfo } from "../../../../common/utils/notification.js";
import { FILTER_EVENTS } from "../../../../common/event/event-constants.js";
import { ConditionEditor } from "./condition-editor.js";

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

  /**
   * 字段名到显示标签的映射
   */
  #fieldLabels = {
    "filename": "文件名",
    "tags": "标签",
    "rating": "评分",
    "review_count": "复习次数",
    "file_size": "文件大小",
    "created_at": "创建时间",
    "last_accessed_at": "访问时间"
  };

  /**
   * 操作符到显示符号的映射
   */
  #operatorToSymbol = {
    "contains": "包含",
    "not_contains": "不包含",
    "has_all": "包含全部",
    "eq": "=",
    "ne": "≠",
    "gt": ">",
    "lt": "<",
    "gte": "≥",
    "lte": "≤",
    "starts_with": "开头是",
    "ends_with": "结尾是",
    "in_range": "范围内",
    "has_tag": "包含",
    "not_has_tag": "不包含"
  };

  /**
   * 渲染到指定容器
   */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();
    this.#setupEventListeners();
    this.#renderTree();
    this.#logger.info("[FilterBuilder] Rendered");
  }

  /**
   * 获取HTML模板
   */
  #getTemplate() {
    return `
      <div class="filter-builder" hidden>
        <!-- 头部 -->
        <div class="filter-builder-header">
          <h3>🎚️ 高级筛选</h3>
          <button class="btn-collapse" aria-label="收起">▲</button>
        </div>

        <!-- 工具栏 -->
        <div class="filter-builder-toolbar">
          <div class="toolbar-group">
            <button class="btn-add-logic" data-logic="AND">+ AND</button>
            <button class="btn-add-logic" data-logic="OR">+ OR</button>
            <button class="btn-add-logic" data-logic="NOT">+ NOT</button>
          </div>
          <button class="btn-add-condition">+ 添加条件</button>
        </div>

        <!-- 条件树 -->
        <div class="filter-tree-container" id="filter-tree-container">
          <!-- 树状结构将在这里渲染 -->
        </div>

        <!-- 底部操作 -->
        <div class="filter-builder-footer">
          <div class="preview">
            <strong>Python表达式:</strong>
            <code id="python-preview">无条件</code>
          </div>
          <div class="actions">
            <button class="btn-reset">重置</button>
            <button class="btn-apply">应用筛选</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 显示构建器
   */
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

  /**
   * 加载可用标签
   */
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

  /**
   * 隐藏构建器
   */
  hide() {
    const builderElement = this.#container.querySelector(".filter-builder");
    if (builderElement) {
      builderElement.hidden = true;
      this.#logger.info("[FilterBuilder] Hidden");
    }
  }

  /**
   * 检查FilterBuilder是否可见
   * @returns {boolean} 是否可见
   */
  isVisible() {
    const builderElement = this.#container.querySelector(".filter-builder");
    return builderElement ? !builderElement.hidden : false;
  }

  /**
   * 渲染树状结构
   */
  #renderTree() {
    const treeContainer = this.#container.querySelector("#filter-tree-container");
    if (!treeContainer) {return;}

    const rootNode = this.#filterTree.root;
    treeContainer.innerHTML = this.#renderNode(rootNode, 0);

    // 绑定节点事件
    this.#bindNodeEvents();

    // 更新工具栏按钮状态
    this.#updateToolbarButtons();
  }

  /**
   * 渲染单个节点
   */
  #renderNode(node, depth) {
    const indent = depth * 24; // 每层缩进24px
    const isSelected = this.#selectedNode && this.#selectedNode.id === node.id;

    if (node.type === "logic") {
      // NOT特殊处理：子节点显示在同一行
      if (node.value === "NOT") {
        const child = node.children.find(c => c.type !== "placeholder");
        const placeholder = node.children.find(c => c.type === "placeholder");

        if (child) {
          // 获取子节点的显示内容（不带外层括号）
          const childContent = this.#getNodeContentText(child, true);
          const childSelected = this.#selectedNode && this.#selectedNode.id === child.id;

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
        } else if (placeholder) {
          // 空的NOT节点：显示带NOT标签的placeholder
          const placeholderSelected = this.#selectedNode && this.#selectedNode.id === placeholder.id;
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

      // AND/OR：正常显示子节点在下一行
      const childrenHTML = node.children.map(child =>
        this.#renderNode(child, depth + 1)
      ).join("");

      // 检查是否是根节点
      const isRoot = this.#isRootNode(node);
      const deleteBtn = !isRoot ? `<button class="btn-delete-node" data-node-id="${node.id}" title="删除">🗑️</button>` : "";

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
          ${this.#renderLogicSwitchMenu(node)}
        </div>
        ${childrenHTML}
      `;
    }

    if (node.type === "condition") {
      const { field, operator, value } = node.value;
      const fieldLabel = this.#fieldLabels[field] || field;
      const operatorSymbol = this.#operatorToSymbol[operator] || operator;

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

  /**
   * 渲染逻辑节点切换菜单（AND <-> OR）
   */
  #renderLogicSwitchMenu(node) {
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
   * 获取节点的显示内容文本
   * @param {Object} node - 节点对象
   * @param {boolean} stripOuterParens - 是否去除外层括号（用于NOT子节点）
   */
  #getNodeContentText(node, stripOuterParens = false) {
    if (node.type === "condition") {
      const { field, operator, value } = node.value;
      const fieldLabel = this.#fieldLabels[field] || field;
      const operatorSymbol = this.#operatorToSymbol[operator] || operator;
      return `${fieldLabel} ${operatorSymbol} "${value}"`;
    }

    if (node.type === "logic") {
      // 如果是逻辑节点，显示为嵌套形式
      const childTexts = node.children
        .filter(c => c.type !== "placeholder")
        .map(c => this.#getNodeContentText(c))
        .join(node.value === "AND" ? " AND " : " OR ");

      const result = `(${childTexts})`;

      // 如果需要去除外层括号（用于NOT的直接子节点）
      if (stripOuterParens) {
        return childTexts; // 直接返回内容，不加括号
      }

      return result;
    }

    return "";
  }

  /**
   * 绑定节点事件
   */
  #bindNodeEvents() {
    // 节点选中
    this.#container.querySelectorAll(".tree-node").forEach(nodeEl => {
      nodeEl.addEventListener("click", (e) => {
        if (e.target.classList.contains("btn-delete-node")) {return;}

        const nodeId = nodeEl.dataset.nodeId;
        const node = this.#filterTree.findNodeById(nodeId);

        if (node) {
          this.#selectedNode = node;
          this.#renderTree();
          this.#logger.debug("[FilterBuilder] Node selected", { nodeId });
        }
      });
    });

    // NOT内联子节点选中
    this.#container.querySelectorAll(".inline-child").forEach(childEl => {
      childEl.addEventListener("click", (e) => {
        e.stopPropagation();
        // 如果点击的是删除按钮，不触发选中
        if (e.target.classList.contains("btn-delete-node") ||
            e.target.classList.contains("btn-delete-inline-child")) {
          return;
        }

        const nodeId = childEl.dataset.nodeId;
        const node = this.#filterTree.findNodeById(nodeId);

        if (node) {
          this.#selectedNode = node;
          this.#renderTree();
          this.#logger.debug("[FilterBuilder] Inline child selected", { nodeId });
        }
      });
    });

    // 删除节点
    this.#container.querySelectorAll(".btn-delete-node").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nodeId = btn.dataset.nodeId;
        this.#deleteNode(nodeId);
      });
    });

    // 删除NOT内联子节点
    this.#container.querySelectorAll(".btn-delete-inline-child").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nodeId = btn.dataset.nodeId;
        this.#deleteInlineChild(nodeId);
      });
    });

    // AND/OR逻辑切换
    this.#container.querySelectorAll(".switchable-logic-label").forEach(label => {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        const nodeId = label.dataset.switchNodeId;
        this.#toggleLogicSwitchMenu(nodeId);
      });
    });

    // 逻辑切换选项
    this.#container.querySelectorAll(".logic-switch-option").forEach(option => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const nodeId = option.dataset.nodeId;
        const switchTo = option.dataset.switchTo;
        this.#switchLogic(nodeId, switchTo);
      });
    });

    // 点击其他地方关闭菜单
    document.addEventListener("click", this.#closeMenusHandler);
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

  /**
   * 重置
   */
  #reset() {
    this.#filterTree = new FilterTree();
    this.#selectedNode = null;
    this.#renderTree();
    this.#updatePreview();
  }

  /**
   * 应用筛选
   */
  applyFilter() {
    this.#logger.info("[FilterBuilder] Applying filter");
    // 构建可序列化的条件配置（与后端 SearchCondition 格式兼容）
    const config = this.getConditionConfig();
    try {
      this.#logger?.debug?.("[FilterBuilder] Built Condition Config", config);
    } catch (e) { try { this.#logger?.warn?.("[FilterBuilder] Log config failed", e); } catch (e2) { void e2; } }
    // 通知 Feature 层：条件已构建
    try {
      this.#eventBus?.emit(FILTER_EVENTS.APPLY.COMPLETED, { condition: config });
    } catch (e) { void e; }
    // 仅隐藏面板，实际发送由上层 Feature 执行
    this.hide();
  }

  /**
   * 获取当前条件配置（转换为后端可识别的结构）
   * @returns {Object} 条件配置
   */
  getConditionConfig() {
    const nodeToConfig = (node) => {
      if (!node) {return null;}
      if (node.type === "logic") {
        const children = (node.children || [])
          .filter((c) => c && c.type !== "placeholder")
          .map((c) => nodeToConfig(c))
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
    };
    const cfg = nodeToConfig(this.#filterTree.root);
    // 根若为 null，返回一个空的 AND 结构；由调用方决定是否传递
    return cfg || { type: "composite", operator: "AND", conditions: [] };
  }

  /**
   * 设置事件监听
   */
  #setupEventListeners() {
    // 收起按钮
    const collapseBtn = this.#container.querySelector(".btn-collapse");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => this.hide());
    }

    // 添加逻辑词按钮
    this.#container.querySelectorAll(".btn-add-logic").forEach(btn => {
      btn.addEventListener("click", () => {
        const logicType = btn.dataset.logic;
        this.#addLogicNode(logicType);
      });
    });

    // 添加条件按钮
    const addConditionBtn = this.#container.querySelector(".btn-add-condition");
    if (addConditionBtn) {
      addConditionBtn.addEventListener("click", () => {
        this.#addConditionNode();
      });
    }

    // 重置按钮
    const resetBtn = this.#container.querySelector(".btn-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.#reset());
    }

    // 应用按钮
    const applyBtn = this.#container.querySelector(".btn-apply");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => this.applyFilter());
    }
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

